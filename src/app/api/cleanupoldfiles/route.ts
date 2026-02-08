import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { supabaseAdmin } from "@/lib/supabaseAdmin"; // ✅ Add this

const s3 = new S3Client({ 
  region: process.env.NEXT_PUBLIC_AWS_REGION!,
  credentials: {
    accessKeyId: process.env.REMOTION_AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.REMOTION_AWS_SECRET_ACCESS_KEY!,
  }
});

const BUCKET = process.env.NEXT_PUBLIC_AWS_BUCKET!;
const REMOTION_BUCKET = "remotionlambda-apsouth1-gagb4x90r1";

export async function GET() {
  const now = Date.now();
  const deleted: string[] = [];
  const startTime = new Date().toISOString();

  console.log(`🕒 [${startTime}] Starting S3 cleanup job`);

  try {
    // ========== CLEANUP STALE TOKEN HOLDS ========== ✅ NEW
    console.log("🧹 Cleaning up stale token holds...");
    
    const fifteenMinutesAgo = new Date(now - 15 * 60 * 1000).toISOString();

    const { data: staleHolds } = await supabaseAdmin
      .from("render_jobs")
      .select("*")
      .in("status", ["queued", "processing", "audio_generation"])
      .eq("is_flagged_for_issue", false)
      .is("lambda_render_id", null)
      .lt("utc_start", fifteenMinutesAgo);

    if (staleHolds && staleHolds.length > 0) {
      for (const hold of staleHolds) {
        await supabaseAdmin
          .from("render_jobs")
          .update({
            status: "failed",
            utc_end: new Date().toISOString(),
            error_message: "Token hold expired - user likely closed browser during audio generation",
          })
          .eq("id", hold.id)
          .eq("user_id", hold.user_id);
      }
      console.log(`🗑️  Cleaned up ${staleHolds.length} stale token holds`);
    } else {
      console.log("⚪ No stale token holds found");
    }

    // ========== FETCH FLAGGED JOBS TO PROTECT THEIR FILES ==========
    const { data: flaggedJobs } = await supabaseAdmin
      .from("render_jobs")
      .select("id, s3_url, utc_end")
      .eq("is_flagged_for_issue", true);

    // Extract S3 keys from flagged jobs (only those less than 24 hours old)
    const flaggedS3Keys = new Set<string>();
    if (flaggedJobs) {
      for (const job of flaggedJobs) {
        if (job.s3_url) {
          try {
            const url = new URL(job.s3_url);
            const key = url.pathname.slice(1); // Remove leading /

            // Only protect files less than 24 hours old
            if (job.utc_end) {
              const jobAgeMs = now - new Date(job.utc_end).getTime();
              if (jobAgeMs < 24 * 3600 * 1000) {
                flaggedS3Keys.add(key);
              }
            }
          } catch {
            console.error("Error parsing S3 URL:", job.s3_url);
          }
        }
      }
    }

    console.log(`🚩 Protecting ${flaggedS3Keys.size} files from flagged jobs`);

    // ========== CLEANUP YOUR BUCKET ==========
    const YOUR_PREFIXES = ["renders/", "uploads/", "audios/", "downloads/"];

    for (const PREFIX of YOUR_PREFIXES) {
      console.log(`📁 Checking ${BUCKET}/${PREFIX}`);

      let continuationToken: string | undefined;

      do {
        const list = await s3.send(
          new ListObjectsV2Command({
            Bucket: BUCKET,
            Prefix: PREFIX,
            ContinuationToken: continuationToken,
          })
        );

        if (!list.Contents || list.Contents.length === 0) {
          console.log(`⚪ No files found under "${PREFIX}", skipping.`);
          break;
        }

        const toDelete: string[] = [];

        for (const obj of list.Contents) {
          if (!obj.Key) continue;

          const isTargetFile = obj.Key.match(/\.(mp4|mov|mkv|avi|mp3|wav)$/i);
          if (!isTargetFile) continue;

          // Skip files from flagged jobs
          if (flaggedS3Keys.has(obj.Key)) {
            continue;
          }

          const ageMs = now - new Date(obj.LastModified!).getTime();

          // Delete if older than 1 hour
          if (ageMs > 3600 * 1000) {
            toDelete.push(obj.Key);
          }
        }

        if (toDelete.length > 0) {
          await s3.send(
            new DeleteObjectsCommand({
              Bucket: BUCKET,
              Delete: {
                Objects: toDelete.map(Key => ({ Key })),
                Quiet: true,
              },
            })
          );
          deleted.push(...toDelete);
          console.log(`🗑️  Deleted ${toDelete.length} files from ${PREFIX}`);
        }

        continuationToken = list.NextContinuationToken;
      } while (continuationToken);
    }

    // ========== CLEANUP REMOTION LAMBDA BUCKET ==========
    console.log(`📁 Checking Remotion bucket: ${REMOTION_BUCKET}/renders/`);
    
    let remotionToken: string | undefined;
    
    do {
      const remotionList = await s3.send(
        new ListObjectsV2Command({
          Bucket: REMOTION_BUCKET,
          Prefix: "renders/",
          Delimiter: "/",
          ContinuationToken: remotionToken,
        })
      );

      if (!remotionList.CommonPrefixes || remotionList.CommonPrefixes.length === 0) {
        console.log(`⚪ No render folders found in Remotion bucket`);
        break;
      }

      for (const folder of remotionList.CommonPrefixes) {
        if (!folder.Prefix) continue;

        const folderContents = await s3.send(
          new ListObjectsV2Command({
            Bucket: REMOTION_BUCKET,
            Prefix: folder.Prefix,
            MaxKeys: 1,
          })
        );

        if (!folderContents.Contents || folderContents.Contents.length === 0) continue;

        const oldestFile = folderContents.Contents[0];
        const folderAgeMs = now - new Date(oldestFile.LastModified!).getTime();

        if (folderAgeMs > 24 * 3600 * 1000) {
          console.log(`🗑️  Deleting old folder: ${folder.Prefix}`);
          
          let folderToken: string | undefined;
          const folderFiles: string[] = [];
          
          do {
            const allFiles = await s3.send(
              new ListObjectsV2Command({
                Bucket: REMOTION_BUCKET,
                Prefix: folder.Prefix,
                ContinuationToken: folderToken,
              })
            );

            if (allFiles.Contents) {
              folderFiles.push(...allFiles.Contents.map(f => f.Key!).filter(Boolean));
            }

            folderToken = allFiles.NextContinuationToken;
          } while (folderToken);

          if (folderFiles.length > 0) {
            for (let i = 0; i < folderFiles.length; i += 1000) {
              const chunk = folderFiles.slice(i, i + 1000);
              await s3.send(
                new DeleteObjectsCommand({
                  Bucket: REMOTION_BUCKET,
                  Delete: {
                    Objects: chunk.map(Key => ({ Key })),
                    Quiet: true,
                  },
                })
              );
            }
            
            deleted.push(...folderFiles);
            console.log(`🗑️  Deleted ${folderFiles.length} files from ${folder.Prefix}`);
          }
        }
      }

      remotionToken = remotionList.NextContinuationToken;
    } while (remotionToken);

    const endTime = new Date().toISOString();

    if (deleted.length > 0) {
      console.log(`🟢 [${endTime}] Cleanup complete, ${deleted.length} file(s) removed ✅`);
    } else {
      console.log(`🟡 [${endTime}] No old files found.`);
    }

    return Response.json({
      success: true,
      deletedCount: deleted.length,
      deletedFiles: deleted.slice(0, 50),
      staleHoldsCleanedUp: staleHolds?.length || 0,
      startedAt: startTime,
      finishedAt: endTime,
    });
  } catch (err) {
    const errorTime = new Date().toISOString();
    console.error(`🔴 [${errorTime}] Cleanup failed:`, err);

    return Response.json({
      success: false,
      error: (err as Error).message,
      failedAt: errorTime,
    }, { status: 500 });
  }
}