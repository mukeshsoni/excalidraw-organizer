import * as React from "react";

export default function BlankCanvasPreviewGraphics(): React.ReactElement {
  return (
    <svg
      viewBox="0 0 230 166"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
    >
      <title>Empty canvas</title>
      <g
        id="spec"
        stroke="none"
        strokeWidth="1"
        fill="none"
        fillRule="evenodd"
        opacity="0.699999988"
      >
        <g transform="translate(-342.000000, -177.000000)" fillRule="nonzero">
          <g transform="translate(457.000000, 260.000000) scale(-1, 1) translate(-457.000000, -260.000000) translate(342.000000, 177.000000)">
            <polygon
              id="Path"
              fill="#E5E5E5"
              points="0 0 230 0 230 166"
            ></polygon>
            <polygon
              id="Path"
              fill="#EAEAEA"
              points="230 0 0 165 0 0"
            ></polygon>
          </g>
        </g>
      </g>
    </svg>
  );
}
