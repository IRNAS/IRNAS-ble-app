/**
 * @format Unit testing main file
 */

import 'react-native';
import React from 'react';
//import App from '../App';

// Note: test renderer must be required after react-native.
import renderer from 'react-test-renderer';
/*
it('renders correctly', () => {
  renderer.create(<App />);
});
*/

// fixes issue: https://github.com/software-mansion/react-native-reanimated/issues/205
jest.mock("react-native-reanimated", () => {
    const View = require('react-native').View;
    return {
        Value: jest.fn(),
        event: jest.fn(),
        add: jest.fn(),
        eq: jest.fn(),
        set: jest.fn(),
        cond: jest.fn(),
        interpolate: jest.fn(),
        View: View,
        Extrapolate: { CLAMP: jest.fn() }
    };
});

// testing framework test
test('Sum equals 2', () => {
    expect(1 + 1).toBe(2);
});

// test EncodeTrackerSettings function
import { EncodeTrackerSettings, DecodeTrackerSettings, convertStringToChars, unpackSetting, GenerateSettingsLookupTable } from '../Helpers';

test('encode no data ', () => {
    var input = "lr_send_interval:";   // device_command
    var output = EncodeTrackerSettings(input);
    var expectedOutput = null;
    expect(output).toBe(expectedOutput);
});

test('encode no command ', () => {
    var input = " : 10";   // device_command
    var output = EncodeTrackerSettings(input);
    var expectedOutput = null;
    expect(output).toBe(expectedOutput);
});

test('encode uint32', () => {
    var input = "lr_send_interval: 10";   // device_command
    var encoded = EncodeTrackerSettings(input);
    var output = unpackSetting(encoded).join(' '); // convert result array to string separated with spaces
    var expectedOutput = "3 1 4 10 0 0 0";
    expect(output).toBe(expectedOutput);
});

test('encode uint16 - command doesn not exist', () => {
    var input = "setting_name_2: 300";   // device_command
    var encoded = EncodeTrackerSettings(input);
    var output = unpackSetting(encoded);
    var expectedOutput = null;
    expect(output).toBe(expectedOutput);
});

test('encode uint8', () => {
    var input = "lr_port: 99";   // device_command
    var encoded = EncodeTrackerSettings(input);
    var output = unpackSetting(encoded).join(' ');
    var expectedOutput = "3 17 1 99";
    expect(output).toBe(expectedOutput);
});

test('encode negative int8', () => {
    var input = "setting_name_4: -4";
    var encoded = EncodeTrackerSettings(input);
    var output = unpackSetting(encoded).join(' ');
    var expectedOutput = "3 20 1 252"; // id 0x14 is 20
    expect(output).toBe(expectedOutput);
});

test('encode negative int16', () => {
    var input = "setting_name_5: -300";
    var encoded = EncodeTrackerSettings(input);
    var output = unpackSetting(encoded).join(' ');
    var expectedOutput = "3 21 2 212 126"; // id 0x15 is 21
    expect(output).toBe(expectedOutput);
});

test('encode negative int32', () => {
    var input = "setting_name_6: -999";
    var encoded = EncodeTrackerSettings(input);
    var output = unpackSetting(encoded).join(' ');
    var expectedOutput = "3 22 4 25 252 255 127"; // id 0x16 is 22
    expect(output).toBe(expectedOutput);
});

test('encode float', () => {
    var input = "setting_name_7: 9.5";
    var encoded = EncodeTrackerSettings(input);
    var output = unpackSetting(encoded).join(' ');
    var expectedOutput = "3 23 4 9 0 136 19"; // id 0x17 is 23, 136 and 19 is little endian for 5000 (which is 0,5 on 4 places)
    expect(output).toBe(expectedOutput);
});

test('encode negative float', () => {
    var input = "setting_name_7: -9.5";
    var encoded = EncodeTrackerSettings(input);
    var output = unpackSetting(encoded).join(' ');
    var expectedOutput = "3 23 4 247 255 136 19"; // id 0x17 is 23
    expect(output).toBe(expectedOutput);
});

test('encode bool', () => {
    var input = "setting_name_9: true";
    var encoded = EncodeTrackerSettings(input);
    var output = unpackSetting(encoded).join(' ');
    var expectedOutput = "3 25 1 1"; // id 0x19 is 25
    expect(output).toBe(expectedOutput);
});

test('encode string', () => {
    var input = "setting_name_8: testing string";
    var stringAsChars = convertStringToChars("testing string").join(' ');
    var encoded = EncodeTrackerSettings(input);
    var output = unpackSetting(encoded).join(' ');
    var expectedOutput = "3 24 14 ";  // id 0x18 is 24
    expectedOutput = expectedOutput.concat(stringAsChars); // testing string as char array is 116, 101, 115, 116, 105, 110, 103, 32, 115, 116, 114, 105, 110, 103
    expect(output).toBe(expectedOutput);
});

test('decode float', () => {
    var input = new Uint8Array([99,212,4,0,0,186,6]).buffer;
    var output = DecodeTrackerSettings(input).join(' ');
    var expectedOutput = "99 212 4 0.1722";
    expect(output).toBe(expectedOutput);
});

test('lookup table generate setting', () => {
    //const settings_json = require('../settings.json');    // read settings.json
    const settings_json = {"settings": {"port": 3, "lr_send_interval" : { "id": "0x01", "default": 10}}};
    var output = GenerateSettingsLookupTable(settings_json);
    var expectedOutput = {"0x01": "lr_send_interval"};
    expect(output).toStrictEqual(expectedOutput);
});
