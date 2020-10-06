/**
 * @format
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

// test EncodeTrackerSetting function
import { EncodeTrackerSetting } from '../Helpers';

test('encode - lr_send_interval: 10', () => {
  var input = "lr_send_interval: 10";   // device_command
  var output = EncodeTrackerSetting(input);
  var expectedOutput = "3 1 4 10 0 0 0";
  expect(output).toBe(expectedOutput);
});
