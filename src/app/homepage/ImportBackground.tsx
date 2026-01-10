import React from "react";
import { Button } from "../../components/Button";
import { Upload, Video } from "lucide-react";
import { Row } from "../../components/Row";
import { Modal } from "../../components/Modal";
import { defaultMyCompProps } from "../../types/constants";

interface ImportBackgroundProps {
  setFormValues: React.Dispatch<
    React.SetStateAction<typeof defaultMyCompProps>
  >;
  setSelectedVideo: (f: File | null) => void;
  selectedVideo: File | null;
}
const ImportBackground = ({
  setFormValues,
  setSelectedVideo,
  selectedVideo,
}: ImportBackgroundProps) => {
  const [importBackground, setImportBackground] = React.useState(false);
  return (
    <>
      <Button variant="ghost" onClick={() => setImportBackground(true)}>
        <Upload size={16} /> Import background video
      </Button>

      <Modal
        open={importBackground}
        onClose={() => setImportBackground(false)}
        title="Import background video (.mp4)"
      >
        <div
          style={{
            display: "grid",
            gap: 18,
            fontSize: 14,
            color: "white",
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              padding: "14px 16px",
              borderRadius: 10,
              lineHeight: 1.6,
            }}
          >
            <p style={{ margin: 0, opacity: 0.85 }}>
              🎥 <b>Recommended video size:</b> <code>1080 × 1920</code>{" "}
              (vertical 9:16)
            </p>
            <p style={{ marginTop: 4, opacity: 0.7 }}>
              Use crisp, subtle footage, think blurred bokeh, clouds, soft
              gradients, or cinematic shots. Your chat UI will overlay perfectly
              on top.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "28px 0",
              border: "1px dashed rgba(255,255,255,0.15)",
              borderRadius: 12,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <Upload size={36} style={{ opacity: 0.7, marginBottom: 8 }} />
            <span style={{ fontSize: 14, opacity: 0.85 }}>
              Drag & drop your .mp4 here
            </span>
            <span style={{ fontSize: 12, opacity: 0.6 }}>
              or click below to browse
            </span>

            <label
              htmlFor="videoUpload"
              style={{
                marginTop: 14,
                cursor: "pointer",
                background:
                  "linear-gradient(90deg, rgba(0,122,255,0.8), rgba(88,86,214,0.8))",
                padding: "8px 16px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Select Video
            </label>

            <input
              id="videoUpload"
              type="file"
              accept="video/mp4"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setSelectedVideo(file); // store file in state
                  const url = URL.createObjectURL(file);
                  setFormValues((p) => ({
                    ...p,
                    backgroundVideo: url,
                  }));
                  console.log(url)
                }
              }}
              style={{ display: "none" }}
            />

            {selectedVideo ? (
              <div
                style={{
                  marginTop: 14,
                  fontSize: 13,
                  opacity: 0.85,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "rgba(255,255,255,0.06)",
                  padding: "6px 12px",
                  borderRadius: 8,
                  maxWidth: "90%",
                  wordBreak: "break-all",
                }}
              >
                <Video size={16} style={{ opacity: 0.7 }} />
                <span>Uploaded video: {selectedVideo.name}</span>
              </div>
            ) : null}
          </div>

          <div
            style={{
              fontSize: 12,
              opacity: 0.65,
              lineHeight: 1.5,
              background: "rgba(255,255,255,0.03)",
              borderRadius: 8,
              padding: "10px 12px",
            }}
          >
            <b>Tips:</b>
            <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
              <li>
                Keep video under <b>500 MB</b> for smooth local preview
                rendering.
              </li>
              <li>
                Your video stays fully on your device , it’s only uploaded to
                the server
                <b> when you export the final video</b>.
              </li>
              <li>
                Muted audio (if present) will be preserved in the final export.
              </li>
              <li>
                Supports seamless looping to perfectly match your conversation
                length.
              </li>
            </ul>
          </div>

          <Row style={{ justifyContent: "flex-end", gap: 8 }}>
            <Button variant="ghost" onClick={() => setImportBackground(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const el = document.getElementById(
                  "videoUpload",
                ) as HTMLInputElement;
                if (!el?.files?.[0]) return;
                const file = el.files[0];
                const url = URL.createObjectURL(file);
                setFormValues((p) => ({
                  ...p,
                  backgroundVideo: url,
                }));
                setImportBackground(false);
              }}
            >
              <Upload size={16} /> Import
            </Button>
          </Row>
        </div>
      </Modal>
    </>
  );
};

export default ImportBackground;
