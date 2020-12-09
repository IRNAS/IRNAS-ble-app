import * as React from 'react';
import Svg, { Path } from "react-native-svg"

/*
const xml = `
  <svg width="32" height="32" viewBox="0 0 32 32">
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      fill="url(#gradient)"
      d="M4 0C1.79086 0 0 1.79086 0 4V28C0 30.2091 1.79086 32 4 32H28C30.2091 32 32 30.2091 32 28V4C32 1.79086 30.2091 0 28 0H4ZM17 6C17 5.44772 17.4477 5 18 5H20C20.5523 5 21 5.44772 21 6V25C21 25.5523 20.5523 26 20 26H18C17.4477 26 17 25.5523 17 25V6ZM12 11C11.4477 11 11 11.4477 11 12V25C11 25.5523 11.4477 26 12 26H14C14.5523 26 15 25.5523 15 25V12C15 11.4477 14.5523 11 14 11H12ZM6 18C5.44772 18 5 18.4477 5 19V25C5 25.5523 5.44772 26 6 26H8C8.55228 26 9 25.5523 9 25V19C9 18.4477 8.55228 18 8 18H6ZM24 14C23.4477 14 23 14.4477 23 15V25C23 25.5523 23.4477 26 24 26H26C26.5523 26 27 25.5523 27 25V15C27 14.4477 26.5523 14 26 14H24Z"
    />
    <defs>
      <linearGradient
        id="gradient"
        x1="0"
        y1="0"
        x2="8.46631"
        y2="37.3364"
        gradient-units="userSpaceOnUse">
        <stop offset="0" stop-color="#FEA267" />
        <stop offset="1" stop-color="#E75A4C" />
      </linearGradient>
    </defs>
  </svg>
`;
*/

//export default RhinoIcon = () => <SvgXml xml={xml} width="20" height="20" />;

function RhinoIcon(props) {
    return (
        <Svg
            width={props.size}
            height={props.size}
            viewBox="0 0 36.4 22.8"
            xmlSpace="preserve"
            fill="#FFFFFF"
            stroke="#000000"
            stroke-miterlimit="10">
            <Path
              className="prefix__cls-1"
              d="M31.66 15.01l-.04 7.66M28.25 22.67l.34-4.15-.6-2.01M18.35 12.85a9.12 9.12 0 002 6.7l-.54 3.12M36.24 1.29C28.34 3 23.82.77 23.82.77l-8.18 1.12-6.79 3.58a3.07 3.07 0 01-1.07 2.88L5 5.83h-.26v3l-3.29-3H.78c.25 6.33 3.57 7.8 3.57 7.8v2.42a10.32 10.32 0 005.62 0 7.51 7.51 0 005.16-4.67M36.23 17.89a12.61 12.61 0 01-4.57-.58M14.24 13.05l4.04 1.51"
            />
        </Svg>
    )
}

export default RhinoIcon;