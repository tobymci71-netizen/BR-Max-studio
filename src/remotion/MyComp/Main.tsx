import { z } from "zod";
import {
  AbsoluteFill,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import React, { useMemo } from "react";
import {
  CompositionProps,
  defaultMyCompProps,
} from "../../types/constants";
import { IMessageOverlay } from "../../components/iMessageOverlay/iMessageOverlay";

loadFont("normal", {
  subsets: ["latin"],
  weights: ["100", "200", "300", "400", "700"],
});

const container: React.CSSProperties = {
  backgroundColor: "white",
};

export const Main = ({
  ...props
}: z.infer<typeof CompositionProps>) => {
  // const { backgroundVideo, greenScreen } = props;
  // const [videoError, setVideoError] = useState(false);

  // Use the already-prepared preview props (player input), but layer defaults for any missing fields.
  const previewProps = useMemo(
    () => ({ ...defaultMyCompProps, ...props }),
    [props],
  );

  const monetizationSettings = useMemo(
    () => previewProps.monetization ?? defaultMyCompProps.monetization,
    [previewProps.monetization],
  );

  // const getBackgroundVideo = useCallback(() => {
  //   if (backgroundVideo) {
  //     if (
  //       backgroundVideo.startsWith("http") ||
  //       backgroundVideo.startsWith("blob")
  //     ) {
  //       return backgroundVideo;
  //     }
  //     return staticFile(backgroundVideo);
  //   }
  //   return staticFile(DEFAULT_BACKGROUND_VIDEO);
  // }, [backgroundVideo]);

  const chatSettings = previewProps.CHAT_SETTINGS;
  const messagesWithCorrectTiming = previewProps.messages;

  // Use green screen color (#00FF00) when greenScreen is enabled
  // const backgroundColor = greenScreen ? "#00FF00" : (videoError ? "green" : "white");
  const backgroundColor = "#00FF00";

  return (
    <AbsoluteFill
      style={{
        ...container,
        backgroundColor,
      }}
    >
      {/* {!greenScreen && !videoError && (
        <Video
          src={getBackgroundVideo()}
          muted
          loop
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          fallbackOffthreadVideoProps={{
            onError: () => setVideoError(true)
          }}
        />
      )} */}
      <IMessageOverlay
        messages={messagesWithCorrectTiming}
        CHAT_SETTINGS={chatSettings}
        monetization={monetizationSettings}
      />
      
    </AbsoluteFill>
  );
};
