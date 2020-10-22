import { ToastAndroid, AlertIOS, Settings } from 'react-native';
import { set } from 'react-native-reanimated';
var Buffer = require('buffer/').Buffer;

const IzOpModesEnum = Object.freeze({ 0:"factory", 1:"storage", 2:"deployment", 3:"operation_slow", 4:"operation_fast" });
const IzConnectionsEnum = Object.freeze({ 0:"offline", 1:"online", 2:"online-psm" });
const settings_json = require('./settings.json');    // read settings.json

const MAX_UINT8 = 255;
const MAX_UINT16 = 65535;
const MAX_UINT32 = 4294967295;

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

export function GenerateSettingsLookupTable(jsonObject) {
    var settingsLookup = {};

    for (const controlCategory in jsonObject) {      // controlCategories means settings, commands, messages, values, etc.
        console.log(controlCategory);
        if (controlCategory === "fw_version" || controlCategory === "hardware") {
            continue;   // skip this
        }
        for (const settingName in jsonObject[controlCategory]) {
            if (settingName === "type") {
                continue;   // skip this
            }
            if (settingName == "port") {
                continue; // TODO use this to double check 
            }
            // read setting id and save it as key, save setting name as value
            let id = jsonObject[controlCategory][settingName].id;
            settingsLookup[id] = settingName.toString();
        }
    }
    return settingsLookup;
}

export function ParseTrackerAdvData(data) {
    // TODO implement this
    return null;
}

export function EncodeTrackerSettings(command) {        // TODO handle multiple commands (make array - for loop)
    var cmd = command.toString().split(":");
    let command_name = cmd[0];
    let command_value = cmd[1];
    
    if (command_name in settings_json.settings) {       // we are writing some settings to the tracker
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
        var header = [port, id, length];
        switch(conversion) {
            case "bool":
                if (value === "true") {
                    var result = packUintToBytes(header, 1);
                    return result;
                }
                else if (value === "false") {
                    var result = packUintToBytes(header, 0);
                    return result;
                }
                else {
                    return null;
                }
            case "string":
                if (value.length > length) {
                    return null;
                }
                header[2] = value.length;
                var valueChars = convertStringToChars(value);
                var result = packUintToBytes(header, valueChars);
                return result;
            case "float":
                cmd_value = parseFloat(value);
                if (cmd_value > max || cmd_value < min) {
                    return null;
                }
                let intPart = parseInt(cmd_value);
                let decimalPart = Math.abs((cmd_value % 1).toFixed(4) * 10000);
                var values = [intPart & 0xff, intPart >> 8, decimalPart & 0xff,  decimalPart >> 8];   // int and decimal part as separate uint16, in array as uint8
                var result = packUintToBytes(header, values);
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
                    if (conversion === "int8") {    // TODO
                        cmd_value += 256;
                    }
                    else if (conversion === "int16") {
                        cmd_value += 32768;
                    }
                    else {
                        cmd_value += 2147483648;
                    }
                }
                var result = packUintToBytes(header, cmd_value);
                return result;
            default:    // uint8, uint16, uint32
                cmd_value = parseInt(value, 10);
                if (cmd_value > max || cmd_value < min) {
                    return null;
                }
                var result = packUintToBytes(header, cmd_value);
                return result;
        }
    }
    else if (command_name in settings_json.commands) {      // we are requesting some values from the tracker
        let port = settings_json.commands.port;
        let id = parseInt(settings_json.commands[command_name].id, 16);
        let length = settings_json.commands[command_name].length;
        let value = settings_json.values[command_value.replace(/\s/g,'')].id;
        var result = packUintToBytes([port, id, length], value);
        return result;
    }
    else {      // unkown command_name, cannot parse
        return null;
    }
}

export function DecodeTrackerSettings(settings) {   // TODO fix this
    // TODO write loop for multiple received settings in the same message
    let unpacked = unpackSetting(settings);
    
    let port = unpacked[0];
    let id = unpacked[1];
    let length = unpacked[2];

    //for (command_name in settings_json.settings) 
    
    let decoded = unpacked;
    return decoded;
}

export function unpackSetting(setting) {
    if (!setting) { // if not valid setting is received
        return null;
    }

    let returnData = [];
    let view = new DataView(setting);
    for (i=0; i < setting.byteLength; i++) {  // copy buffer data to array of uint8
        returnData.push(view.getUint8(i));
    }
    return returnData;  // return value as bytes
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

export function convertStringToChars(string) {
    charArray = [];
    for (i = 0; i < string.length; i++) {
        charArray.push(string.charCodeAt(i));
    }
    return charArray;
}

function convertCharsToString(charArray) {
    string = "";
    for (i = 0; i < charArray.length; i++) {
        string += String.fromCharCode(charArray[i]);
    }
    return string;
}

export function packUintToBytes(header, value) {
    let headerLength = header.length;
    if (headerLength !== 3) {
        console.log("Error when packing UintToBytes - header not OK!");
        return null;
    }
    let valueLength = header[2];        // we expect length information on the third place in the header buffer
    let arr = new ArrayBuffer(headerLength + valueLength);        // total lenght of the buffer is header + value lengths
    let view = new DataView(arr);

    for (i = 0; i < headerLength; i++) {  // copy header to buffer
        view.setUint8(i, header[i]);
    }
    
    switch (valueLength) {  // copy value to buffer, byteOffset = headerLength, litteEndian = true
        case 1:    //uint8 or bool
            view.setUint8(headerLength, value);
            break;
        case 2:     // uint16
            if (Array.isArray(value)) {
                for (i = 0; i < valueLength; i++) {
                    view.setUint8(headerLength+i, value[i]);
                }
            } 
            else {
                view.setUint16(headerLength, value, true);
            }
            break;
        case 4:     //uint32
            if (Array.isArray(value)) {
                for (i = 0; i < valueLength; i++) {
                    view.setUint8(headerLength+i, value[i]);
                }
            } 
            else {
                view.setUint32(headerLength, value, true);
            }
            break;
        default:    // string
            for (i = 0; i < valueLength; i++) {  // copy values to buffer
                view.setUint8(headerLength+i, value[i]);
            }
            break;
    }
    //console.log(new Uint8Array(arr));
    return arr;
}
