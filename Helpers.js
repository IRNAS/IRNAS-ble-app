import { ToastAndroid, AlertIOS } from 'react-native';
import { Buffer } from "buffer";

const IzOpModesEnum = Object.freeze({0:"factory", 1:"storage", 2:"deployment", 3:"operation_slow", 4:"operation_fast" });
const IzConnectionsEnum = Object.freeze({0:"offline", 1:"online", 2:"online-psm"});

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
    var izo_data = { leakage: -1, surge: -1, battery: -1, op_mode: "unknown", connection: "unknown" }

    izo_data.leakage = data.readInt16BE(0);
    izo_data.surge = data.readInt8(2);
    izo_data.battery = data.readInt8(3);
    
    let op_mode_connection = data.readInt8(4);
    //izo_data.op_mode
    //izo_data.connection

    return izo_data;
}