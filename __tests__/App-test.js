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

// testing framework test
test('Sum equals 2', () => {
      expect(1+1).toBe(2);
});

// test EncodeTrackerSettings function
import { EncodeTrackerSettings, DecodeTrackerSettings } from '../Helpers';

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
  var output = DecodeTrackerSettings(encoded).join(' '); // convert result array to string separated with spaces
  var expectedOutput = "3 1 4 10 0 0 0";
  expect(output).toBe(expectedOutput);
});

test('encode uint16', () => {
  var input = "setting_name_2: 300";   // device_command
  var encoded = EncodeTrackerSettings(input);
  var output = DecodeTrackerSettings(encoded).join(' ');
  var expectedOutput = "3 18 2 44 1";
  expect(output).toBe(expectedOutput);
});

test('encode uint8', () => {
  var input = "setting_name_1: 255";   // device_command
  var encoded = EncodeTrackerSettings(input);
  var output = DecodeTrackerSettings(encoded).join(' ');
  var expectedOutput = "3 17 1 255";
  expect(output).toBe(expectedOutput);
});

test('encode negative int8', () => {
  var input = "setting_name_4: -4";
  var encoded = EncodeTrackerSettings(input);
  var output = DecodeTrackerSettings(encoded).join(' ');
  var expectedOutput = "3 20 1 252"; // id 0x14 is 20
  expect(output).toBe(expectedOutput);
});

test('encode negative int16', () => {
  var input = "setting_name_5: -300";
  var encoded = EncodeTrackerSettings(input);
  var output = DecodeTrackerSettings(encoded).join(' ');
  var expectedOutput = "3 21 2 212 126"; // id 0x15 is 21
  expect(output).toBe(expectedOutput);
});

test('encode negative int32', () => {
  var input = "setting_name_6: -999";
  var encoded = EncodeTrackerSettings(input);
  var output = DecodeTrackerSettings(encoded).join(' ');
  var expectedOutput = "3 22 4 25 252 255 127"; // id 0x16 is 22
  expect(output).toBe(expectedOutput);
});

test('encode float', () => {
  var input = "setting_name_7: 9.5";
  var output = EncodeTrackerSettings(input);
  var expectedOutput = "3 23 4 9.5"; // id 0x17 is 23
  expect(output).toBe(expectedOutput);
});

test('encode negative float', () => {
  var input = "setting_name_7: -9.5";
  var output = EncodeTrackerSettings(input);
  var expectedOutput = "3 23 4 -9.5"; // id 0x17 is 23
  expect(output).toBe(expectedOutput);
});

test('encode bool', () => {
  var input = "setting_name_9: true";
  var output = EncodeTrackerSettings(input);
  var expectedOutput = "3 25 1 1"; // id 0x19 is 25
  expect(output).toBe(expectedOutput);
});

test('encode string', () => {
  var input = "setting_name_8: testing string";
  var output = EncodeTrackerSettings(input);
  var expectedOutput = "3 24 14 testing string"; // id 0x18 is 24
  expect(output).toBe(expectedOutput);
});