import { ToastAndroid, AlertIOS, Settings } from 'react-native';
var Buffer = require('buffer/').Buffer;

const IzOpModesEnum = Object.freeze({ 0:"factory", 1:"storage", 2:"deployment", 3:"operation_slow", 4:"operation_fast" });
const IzConnectionsEnum = Object.freeze({ 0:"offline", 1:"online", 2:"online-psm" });
const settings_json = require('./settings.json');    // read settings.json

export function NotifyMessage(msg) {
    if (Platform.OS === 'android') {
        ToastAndroid.show(msg, ToastAndroid.SHORT)
    } else {
        //AlertIOS.alert(msg);
        console.log(msg);
    }
}

export function EncodeBase64(data) {    // TODO rewrite this
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

export function ParseTrackerAdvData(data) {
    // TODO implement this
    return null;
}


export function EncodeTrackerSettings(command) {        // TODO handle multiple commands (make array - for loop)
    var cmd = command.toString().split(":");
    let command_name = cmd[0];
    let command_value = cmd[1];
    
    if (command_name in settings_json.settings) {
        let port = settings_json.settings.port;
        let id = parseInt(settings_json.settings[command_name].id, 16);
        let length = settings_json.settings[command_name].length;
        let max = settings_json.settings[command_name].max;
        let min = settings_json.settings[command_name].min;
        let conversion = settings_json.settings[command_name].conversion;
        
        let value = command_value.substring(1);
        if (value.length === 0) {
            return null;
        }
        switch(conversion) {
            case "bool":
                if (value === "true") {
                    var result = [port, id, length, 1].join(' ');
                    return result;
                }
                else if (value === "false") {
                    var result = [port, id, length, 0].join(' ');
                    return result;
                }
                else {
                    return null;
                }
            case "string":  // TODO
                if (value.length > length) {
                    return null;
                }
                var result = [port, id, value.length, value].join(' ');
                return result;
            case "float":   // TODO
                cmd_value = parseFloat(value);
                if (cmd_value > max || cmd_value < min) {
                    return null;
                }
                var header = [port, id, length].join(' ') + ' ';
                var values = ConvertFloatToByteArray(cmd_value).join(' ');
                var result = header.concat(values);
                return result;
            case "packed values":
                // TODO
                return null;
            case "int8":
            case "int16":
            case "int32":
                cmd_value = parseInt(value, 10); 
                if (cmd_value > max || cmd_value < min) {
                    return null;
                }
                if (cmd_value < 0) {
                    if (conversion === "int8") {
                        cmd_value += 256;
                    }
                    else if (conversion === "int16") {
                        cmd_value += 32768;
                    }
                    else {
                        cmd_value += 2147483648;
                    }
                }
                var header = [port, id, length];
                var result = packUintToBytes(header, cmd_value);    // TODO test this
                return result;
            default:    // uint8, uint16, uint32
                cmd_value = parseInt(value, 10);
                if (cmd_value > max || cmd_value < min) {
                    return null;
                }
                var header = [port, id, length];
                var result = packUintToBytes(header, cmd_value);    // TODO test this
                return result;
        }
    }
    else {
        return null;
    }
}

export function DecodeTrackerSettings(settings) {
    // TODO write loop for multiple received settings in the same message
    // TODO use DecodeUintValue
    return unpackSetting(settings);
}

function unpackSetting(setting) {
    let view = new DataView(setting);
    let port = view.getUint8(0);
    let id = view.getUint8(1);
    let length = view.getUint8(2);
    var returnData = [port, id, length];

    // return value as bytes for now
    for (i=3; i < length+3; i++) {  // copy header to buffer
        returnData.push(view.getUint8(i));
    }
    return returnData;
}

function DecodeUintValue(number) {      
    switch (length) {  // copy value to buffer, byteOffset = 3, litteEndian = true
        case 1:     //uint8
            value = view.getUint8(3, true);
            break;
        case 2:     // uint16
            value = view.getUint16(3, true);
            break;
        default:    //uint32
            value = view.getUint32(3, true);
            break;
    }
}

function packUintToBytes(header, num) {
    let headerLength = header.length;
    if (headerLength !== 3) {
        console.log("Error when packing UintToBytes - header not OK!");
        return null;
    }
    let valueLength = header[2];        // we expect length information on the third place in the header buffer
    let arr = new ArrayBuffer(headerLength + valueLength);        // total lenght of the buffer is header + value lengths
    let view = new DataView(arr);

    for (i=0; i < headerLength; i++) {  // copy header to buffer
        view.setUint8(i, header[i]);
    }

    switch (valueLength) {  // copy value to buffer, byteOffset = headerLength, litteEndian = true
        case 1:     //uint8
            view.setUint8(headerLength, num, true);
            break;
        case 2:     // uint16
            view.setUint16(headerLength, num, true);
            break;
        default:    //uint32
            view.setUint32(headerLength, num, true);
            break;
    }
    return arr;
}

function ConvertFloatToByteArray(num) {
    let b = new ArrayBuffer(4);
    new DataView(b).setFloat32(0, num, true);
    return new Float32Array(b);
}