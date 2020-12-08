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
    let viewBox = "0 0 " + props.size + " " + props.size
    return (
        <Svg
            width={props.size}
            height={props.size}
            viewBox={viewBox}
            xmlSpace="preserve"
            fill="#FFFFFF"
            stroke="#000000"
            stroke-miterlimit="10">
            <Path
            d="M15.76 12.11c2.93-.62 10.04 5.46 10.04 5.46 1.24.8 6.78 1.17 6.97 1.29 1.47.89 1.42 2.67 1.42 2.67-.93 2.4-1.38 2.53-1.38 2.53-4.71.53-8.88 0-8.88 0-.22.22-.33.43-.32.63.05.88 2.35 1.62 6.89 2.22-2.53.91-5.94 1.82-10.04 2.07-2.31.14-4.39.04-6.18-.16l-3.73-.71"
            />
            <Path
            d="M27.09 17.66c-.1-.05-.67-.31-.84-.53-.46-.58.51-2.4 2.35-4.4.17.57.36 1.41.36 2.44 0 .57.01 2.56-.76 2.8-.27.08-.58-.06-1.11-.31zM30.38 18.37c-.68-.55.21-2.92 1.25-4.84.69-1.27 1.83-3.04 3.68-4.89.22 2.67-.03 4.79-.31 6.26-.12.61-.81 4.22-1.83 4.24-.19 0-.23-.12-.65-.33-1.09-.53-1.77-.14-2.14-.44zM12.48 16.64a7.22 7.22 0 01-2.35-2.22c-.76-1.15-.95-2.22-1.07-2.84-.42-2.33.2-4.28.62-5.29.62.2 3.19 1.14 4.66 3.86 1.07 1.97 1 3.85.93 4.62M17.63 17.08c1.33-.62 3.11-.89 3.11-.89"
            />
        </Svg>
    )
}

export default RhinoIcon;