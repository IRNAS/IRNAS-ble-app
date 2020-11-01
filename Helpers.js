import { ToastAndroid, AlertIOS } from 'react-native';
var Buffer = require('buffer/').Buffer;

const IzOpModesEnum = Object.freeze({ 0:"factory", 1:"storage", 2:"deployment", 3:"operation_slow", 4:"operation_fast" });
const IzConnectionsEnum = Object.freeze({ 0:"offline", 1:"online", 2:"online-psm" });

export const BLE_RETRY_COUNT = 5;

export const IrnasGreen = '#5baf49';
export const lightGreen = '#7dbd62';

export function NotifyMessage(msg) {
    if (Platform.OS === 'android') {
        ToastAndroid.show(msg, ToastAndroid.SHORT)
    } else {
        //AlertIOS.alert(msg);
        console.log(msg);
    }
}

export function EncodeBase64(data) {
    const buff = new Buffer(data);
    const buffStr = buff.toString('base64');
    return buffStr;
}

export function DecodeBase64(data) {
    const result = Buffer.from(data, 'base64');
    return result;
}

export function ReplaceAll(string, search, replace) {
    return string.split(search).join(replace);
}

export function GetTimestamp() {
    var today = new Date();
    var time = today.getHours() + ":" + today.getMinutes() + ":";
    var seconds = today.getSeconds();
    if (seconds < 10) {
        time += "0" + seconds;
    }
    else {
        time += seconds;
    }
    time += ".";
    var miliSeconds = today.getMilliseconds();
    time += miliSeconds;
    if (miliSeconds < 100) {
        time += "0";
    }
    return time;
}

export function GetFullTimestamp() {
    var today = new Date();
    var date = today.getFullYear() + "-" + today.getMonth() + "-" + today.getDate();
    var time = today.getHours() + "-" + today.getMinutes() + "-" + today.getSeconds();
    return (date + "T" + time);
}

export function ParseIzData(data) {
    var iz_data = { leakage: -1, surge: -1, battery: -1, op_mode: "unknown", connection: "unknown" };

    iz_data.leakage = data.readInt16LE(2);
    iz_data.surge = data.readInt8(4);
    
    let bat_8bit = data[5];
    let range = (Math.pow(2, 8) - 1) / 4000;
    iz_data.battery = parseInt(bat_8bit / range, 10);
    
    let op_mode_conn = data.readInt8(6);
    iz_data.op_mode = IzOpModesEnum[op_mode_conn >> 4];
    iz_data.connection = IzConnectionsEnum[op_mode_conn & 0x0F];

    return iz_data;
}