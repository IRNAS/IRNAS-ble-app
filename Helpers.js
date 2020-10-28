import { ToastAndroid, AlertIOS, Settings } from 'react-native';
import { set } from 'react-native-reanimated';
var Buffer = require('buffer/').Buffer;

export const mtuSize = 30;

const IzOpModesEnum = Object.freeze({ 0: "factory", 1: "storage", 2: "deployment", 3: "operation_slow", 4: "operation_fast" });
const IzConnectionsEnum = Object.freeze({ 0: "offline", 1: "online", 2: "online-psm" });
const settings_json = require('./settings.json');    // read settings.json
const settingsLookupTable = GenerateSettingsLookupTable();

const HALF_UINT8 = 128;
const HALF_UINT16 = 32768;
const HALF_UINT32 = 2147483648;

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
    if (!jsonObject) {
        jsonObject = settings_json;
    }
    var settingsLookup = {};

    for (const controlCategory in jsonObject) {      // controlCategories means settings, commands, messages, values, etc.
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
            let idAsNum = parseInt(Number(id, 10));
            settingsLookup[idAsNum] = { "name": settingName.toString(), "control_category": controlCategory };
        }
    }
    if (!settingsLookup || Object.keys(settingsLookup).length === 0) {
        return null;
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
        switch (conversion) {
            case "bool":
                if (value === "true") {
                    var result = packUintToBytes(header, 1);
                    return result;
                }
                else if (value === "false") {
                    var result = packUintToBytes(header, 0);
                    return result;
                }
                return null;
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
                var values = [intPart & 0xff, intPart >> 8, decimalPart & 0xff, decimalPart >> 8];   // int and decimal part as separate uint16, in array as uint8
                var result = packUintToBytes(header, values);
                return result;
            case "byte_array":
                // TODO
                return null;
            case "int8":
            case "int16":
            case "int32":
                cmd_value = parseInt(value, 10);
                // check borders
                if (cmd_value > max || cmd_value < min) {
                    return null;
                }
                // convert int to uint
                if (conversion === "int8") {
                    cmd_value += HALF_UINT8;
                }
                else if (conversion === "int16") {
                    cmd_value += HALF_UINT16;
                }
                else {
                    cmd_value += HALF_UINT32;
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
        let result;
        if (length === 0) {     // if we don't have any value, just header (ex. cmd_send_status)
            result = packUintToBytes([port, id, length]);
        }
        else {      // if we have header and the value
            let value = settings_json.values[command_value.replace(/\s/g, '')].id;
            result = packUintToBytes([port, id, length], value);
        }
        return result;
    }
    else {      // unkown command_name, cannot parse
        return null;
    }
}

export function DecodeTrackerSettings(settings) {   // TODO write loop for multiple received settings in the same message
    // for now this function decodes SINGLE setting received from tracker
    let unpacked = unpackBytesToUint(settings);
    // get header data
    let port = unpacked[0];
    let id = unpacked[1];
    let length = unpacked[2];
    // check if id is valid
    if (settingsLookupTable[id] === undefined) {
        return null;
    }
    // get value data
    let controlCategory = settingsLookupTable[id].control_category;
    let name = settingsLookupTable[id].name;
    // check if value data has proper length
    if (length !== unpacked.length - 3) {
        return null;
    }
    // parse value data acording to conversion (type)
    let definedLength = settings_json[controlCategory][name].length;
    let max = settings_json[controlCategory][name].max;
    let min = settings_json[controlCategory][name].min;
    let conversion = settings_json[controlCategory][name].conversion;
    let value = null;
    switch (conversion) {
        case "bool":
            if (unpacked[3] === 1) {
                return [name, true];
            }
            else if (unpacked[3] === 0) {
                return [name, false];
            }
            return null;
        case "string":
            if (length > definedLength) {
                return null;
            }
            value = convertCharsToString(unpacked.slice(3));
            return [name, value];
        case "float":
            if (length !== definedLength) {
                return null;
            }
            let intPart = (unpacked[4] << 8) | unpacked[3];
            let decimalArr16 = new Int16Array(1);
            decimalArr16[0] = (unpacked[6] << 8) | unpacked[5];
            let decimalPart = decimalArr16[0] / 10000;
            value = intPart + decimalPart;
            if (value > max || value < min) {
                return null;
            }
            return [name, value];
        case "byte_array":
            if (name === "msg_status") {
                value = DecodeStatusMessage(unpacked);      // TODO value stays as object
                return [name, value];
            }
            else if (name === "msg_location") {
                return null;
            }
            return null;
        case "int8":
        case "int16":
        case "int32":
            let intArray = unpacked.slice(3);
            value = DecodeUintValue(intArray);
            // convert uint to int
            if (conversion === "int8") {
                value -= HALF_UINT8;
            }
            else if (conversion === "int16") {
                value -= HALF_UINT16;
            }
            else {
                value -= HALF_UINT32;
            }
            // check borders
            if (value > max || value < min) {
                return null;
            }
            return [name, value];
        default:    // uint8, uint16, uint32
            value = DecodeUintValue(unpacked.slice(3));
             if (value > max || value < min) {
                return null;
            }
            return [name, value];
    }
}

function DecodeUintValue(array) {
    switch (array.length) {  // copy value to buffer, byteOffset = 3, litteEndian = true
        case 1:     //uint8
            value = array[0];
            break;
        case 2:     // uint16
            value = (array[1] << 8) | array[0];
            break;
        default:    //uint32
            value = (array[3] << 24) | (array[2] << 16) | (array[1] << 8) | array[0];
            break;
    }
    return value;
}

function DecodeStatusMessage(bytes) {
    var reset = bytes[0];
    var err = bytes[1];
    var bat = (bytes[2] * 10) + 2500;
    var volt = bytes[3];
    var temp = bytes[4];
    var uptime = bytes[5];
    var acc_x = bytes[6] / 10;
    var acc_y = bytes[7] / 10;
    var acc_z = bytes[8] / 10;

    decoded = {
        reset: reset,
        err: err,
        bat: bat,
        volt: volt,
        temp: temp,
        uptime: uptime,
        acc_x: acc_x,
        acc_y: acc_y,
        acc_z: acc_z,
    };  
    return decoded;
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
                    view.setUint8(headerLength + i, value[i]);
                }
            }
            else {
                view.setUint16(headerLength, value, true);
            }
            break;
        case 4:     //uint32
            if (Array.isArray(value)) {
                for (i = 0; i < valueLength; i++) {
                    view.setUint8(headerLength + i, value[i]);
                }
            }
            else {
                view.setUint32(headerLength, value, true);
            }
            break;
        default:    // string
            for (i = 0; i < valueLength; i++) {  // copy values to buffer
                view.setUint8(headerLength + i, value[i]);
            }
            break;
    }
    //console.log(new Uint8Array(arr));
    return arr;
}

export function unpackBytesToUint(setting) {
    if (!setting) { // if not valid setting is received
        return null;
    }

    let returnData = [];
    let view = new DataView(setting);
    for (i = 0; i < setting.byteLength; i++) {  // copy buffer data to array of uint8
        returnData.push(view.getUint8(i));
    }
    return returnData;  // return value as bytes
}
