import React from "react";

export function ArrowDown() {
  return (
    <div
      style={{
        width: "50px",
        height: "200px",
        background: "red",
        margin: "0 auto",
        position: "relative",
      }}
    >
      <div
        style={{
          content: '""',
          position: "absolute",
          left: "50%",
          bottom: "-60px",
          transform: "translateX(-50%)",
          width: "0",
          height: "0",
          borderLeft: "60px solid transparent",
          borderRight: "60px solid transparent",
          borderTop: "80px solid red",
        }}
      />
    </div>
  );
}