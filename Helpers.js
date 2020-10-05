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

export function ParseTrackerAdvData(data) {
    // TODO implement this
    return null;
}

// parse tracker commands specified in default_config.json with settings.json -> generate uart_command (raw command to send)
export function ParseDeviceCommands(config) {
    var return_config = config;
    for (var command of config) {
        if (command.uart_command === null) {
            let update_command = EncodeTrackerSetting(command.device_command);
            if (update_command !== null) {
                return_config.uart_command = update_command;
            }
        }
    }
    return return_config;
}

function EncodeTrackerSetting(command) {
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
        switch(conversion) {
            case "bool":
                // TODO
                break;
            case "string":
                // TODO
                break;
            case "packed values":
                // TODO
                break;
            default:
                value = parseInt(command_value, 10); 
                if (value > max || value < min) {
                    return null;
                }
                var header = [port, id, length].join(' ') + ' ';
                var values = ConvertNumToByteArray(value, length).join(' ');
                var result = header.concat(values);
                return result;
        }
    }
    else {
        return null;
    }
}

function DecodeTrackerSetting(setting) {

}

function ConvertNumToByteArray(num, length) {
    let b = new ArrayBuffer(4);
    new DataView(b).setUint32(0, num);
    return new Uint8Array(b).reverse().slice(0,length);
}
