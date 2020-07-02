/**
 * IRNAS BLE app to communicate with Nordic UART Service profile
 * Tested with server in Nrf connect Android app
 *
 * @format
 * @flow strict-local
 */

import React, { Component } from 'react';
import { StyleSheet, ScrollView, View, Text, StatusBar, Button, FlatList, Alert, TextInput, TouchableOpacityBase, TouchableWithoutFeedbackBase } from 'react-native';
import { jHeader, LearnMoreLinks, Colors, DebugInstructions, ReloadInstructions } from 'react-native/Libraries/NewAppScreen';

import { BleManager, LogLevel } from 'react-native-ble-plx';
import RNLocation from 'react-native-location';

import ListDeviceItem from './components/ListDeviceItem';
import UartButton from './components/UartButton';
import { EncodeBase64, DecodeBase64, NotifyMessage, ReplaceAll, GetTimestamp}  from './Helpers';

//console.disableYellowBox = true;  // disable yellow warnings in the app

function Separator() {
  return <View style={styles.separator} />;
}

class App extends React.Component {
  constructor() {
    super();
    this.manager = new BleManager();
    this.manager.setLogLevel(LogLevel.Debug);
    this.state = {
      failed: true,
      scanRunning: false,
      NotifyData: [],
      device: undefined,
      numOfDevices: 0,
      notificationsRunning: false,
      writeText: "",
      jsonEditActive: false,
      jsonText: {},
      writeScreenActive: true,
    };
    this.devices = [];
    this.services = {};

    this.uartService = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";
    this.uartRx = "6E400002-B5A3-F393-E0A9-E50E24DCCA9E";   // write
    this.uartTx = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E";   // notify

    this.bleFilterName = "";
    this.bleFilterMac = "";
    this.uartCommands = [];

    this.oldJson = {};
  }

  componentDidMount() {
    this.checkBLE();

    var data = require('./Test.json');
    //console.log(data);
    this.setState({jsonText: data}, this.parseJsonConfig);
  }

  componentWillUnmount() {
    if (this.state.device !== undefined) {
      this.disconnect();
      // TODO cancel asynchronous task (notify)
      this.notificationsOnOff();
    }
  }

  checkBLE() {
    console.log("Checking Bluetooth");
    const subscription = this.manager.onStateChange((state) => {
      if (state === 'PoweredOn') {
        console.log("Bluetooth OK");
        subscription.remove();
      } else {
        NotifyMessage("Bluetooth not OK, state: " + state.toString());
      }
    }, true);

    console.log("Checking location");
    RNLocation.requestPermission({
      ios: "whenInUse",
      android: {
        detail: "coarse"
      }
    }).then(granted => {
        if (granted) {
          console.log("Location OK");
        }
        else {
          NotifyMessage("In order to scan for BLE devices, location access must be granted!");
        }
    });
  }

  startStopScan() {
    if (this.state.scanRunning) {  // scan is running
      this.stop();
    }
    else {  // scan is not running
      this.scan();
    }
  }

  scan() {
    //console.log("Scanning...");
    this.setState({scanRunning: true});
    this.manager.startDeviceScan(null, null , (error, scannedDevice) => {
      if (error) {
        NotifyMessage("Scan error: " + JSON.stringify(error.message));
        this.setState({scanRunning: false});
        return;
      }
      if (scannedDevice) {
        console.log(scannedDevice.id, ", ", scannedDevice.localName, ", ", scannedDevice.name, ", ", scannedDevice.rssi);
        let containsDevice = false;
        for (device of this.devices) {
          if (device.id === scannedDevice.id) {
            containsDevice = true;
            break;
          }
        }
        if (!containsDevice) {
          this.setState({numOfDevices: this.state.numOfDevices++})
          this.devices.push(scannedDevice);
        }
      }
    });
  }

  stop() {
    this.manager.stopDeviceScan();
    console.log("Found " + this.devices.length + " devices.");
    this.setState({scanRunning: false});
  }

  connectToDevice = item => {
    console.log("selected device: " + item.id + " " + item.name);
    this.stop();
    this.connect(item);
  }

  connect(item) {
    const device = item;
    //this.setState({device: item});
    //console.log(device);

    if (device !== undefined) {
      NotifyMessage("connecting to device: " + device.id);
      device.connect()
      .then((device) => {
        //let allCharacteristics = device.discoverAllServicesAndCharacteristics()
        //console.log("chars: ");
        //console.log(allCharacteristics)
        //console.log(allCharacteristics)
        return device.discoverAllServicesAndCharacteristics();
      })
      .then((device) => {
        let services = device.services(device.id);
        return services;
      })
      .then((services) => {
        console.log("found services");
        this.services = services;
        NotifyMessage("Connect OK");
        this.setState({device: item}, this.notificationsOnOff);
      })
      .catch ((error) => {
        NotifyMessage("Error when connecting to selected device.");
        // TODO add connect retry
        console.log(error.message);
        this.setState({device: undefined});
      });
    }
  }

  disconnect() {
    var device = this.state.device;
    if (device !== undefined) {
      NotifyMessage("disconnecting from device: ", device.id);
      this.manager.cancelDeviceConnection(device.id)
      .then((device) => {
        NotifyMessage("Disconnect OK");
        this.setState({device: undefined});
      });
    }
  }

  notify() {
    if (this.state.device !== undefined) {
      NotifyMessage("Turning on notifications: " + this.state.device.id.toString());
      this.setupNotifications()
      .then(() => {
        NotifyMessage("Listening...");
        this.setState({notificationsRunning: true});
      }, (error) => {
        console.log(error.message);
        this.setState({notificationsRunning: false});
      });
    }
  }

  notifyStop() {
    if (this.state.device !== undefined) {
      //NotifyMessage("Turning off notifications");
      this.setState({notificationsRunning: false});
    }
  }

  notificationsOnOff() {
    if (this.state.notificationsRunning) {
      this.notifyStop();
    }
    else {
      this.notify();
    }
  }

  async setupNotifications() {
    //const characteristic = await device.writeCharacteristicWithResponseForService( service, characteristicW, "AQ==");

    this.state.device.monitorCharacteristicForService(this.uartService, this.uartTx, (error, characteristic) => {
      if (error) {
        console.log("ERROR: " + error.message);
        return;
      }
      //console.log("Char monitor: " + characteristic.uuid, characteristic.value);
      const result = DecodeBase64(characteristic.value);
      //console.log(result.length);
      console.log("Received data from device: " + result);
      const stringResult = GetTimestamp()  + ": " + result.toString();
      this.setState(prevState => ({   // updater function to prevent race conditions (append new data)
        NotifyData: [...prevState.NotifyData, stringResult + "\n"]
      }));
    });
  }

  handleWriteText = text => {
    this.setState({ writeText: text});
  }

  write() {
    //device.writeCharacteristicWithoutResponseForService(this.nordicUartService, this.uartRx, "heh")
    let encoded; // = EncodeBase64([1]);
    if (this.state.writeText) {   // if user write data send that
      encoded = EncodeBase64(this.state.writeText);
    }
    //console.log("Writing encoded data: " + encoded);

    this.state.device.writeCharacteristicWithoutResponseForService(this.uartService, this.uartRx, encoded)
    .then(() => {
      NotifyMessage("Write ok...")
    }, (error) => {
      console.log(error.message);
    })
  }

  read() {
    // TODO GATT request MTU?
    const dev = this.state.device;
    //device.readCharacteristicForService(this.nordicUartService, this.readChar)
    dev.readCharacteristicForService(this.hrService, this.hrBodySensorLoc)
    .then((chara) => {
      //console.log("read ok");
      const result = DecodeBase64(chara.value);
      //console.log(result.length);
      NotifyMessage("Read: " + result[0]);
    }, (error) => {
      console.log(error.message);
    })
  }

  displayAllServices() {
    var servicesStr = "";
    var service;
    for (service of this.services) {
      //console.log(service);
      servicesStr += service.uuid + "\n";
    }
    Alert.alert("Services", servicesStr);
  }

  displayResults() {
    const devices = this.devices;
    if (devices.length > 0) {
      return (
        <FlatList
                data = {devices}
                renderItem={({ item }) => <ListDeviceItem item_in={item} connectToDevice={this.connectToDevice} />}
              />
        );
    }
    else {
      return <Text style={styles.title}>No devices</Text>;
    }
  }

  parseJsonConfig() {
    let data = this.state.jsonText;

    if (data.device_filter !== undefined) {
      this.bleFilterName = data.device_filter.name;
      // TODO use mac filtering
      console.log("JSON data: found filters.");
    }
    if (data.commands !== undefined) {
      console.log("JSON data: found " + data.commands.length + " commands.");
      this.uartCommands = data.commands;
    }

    this.oldJson = data;
    NotifyMessage("JSON parsed OK");
  }

  cleanJsonText = text => {
    //let cleanText = ReplaceAll(text, "\n", "");
    this.setState({ jsonText: JSON.parse(text)});
  }

  openJsonConfig() {
    this.setState({ jsonEditActive: true});
  }

  closeJsonConfig(save) {
    if (save) {
      this.parseJsonConfig();
    }
    else {
      this.setState({ jsonText: this.oldJson});
    }
    this.setState({ jsonEditActive: false});
  }

  displayUartButtons() {
    const views = [];
    var command;
    for (command of this.uartCommands) {
      views.push(<UartButton title={command.name} uart_command={command.uart_command} writeUartCommand={this.writeUartCommand}/>)
    }
    return views;
  }

  writeUartCommand = uart => {
    console.log('button clicked, writing command: ' + uart);
    this.setState({ writeText: uart}, this.write);
  }

  displayLogs() {
    if (this.state.writeScreenActive) {
      this.setState({ writeScreenActive: false });
    }
    else {
      this.setState({ writeScreenActive: true });
    }
  }

  render() {
    if (this.state.device === undefined) {
      if (this.state.jsonEditActive) {  // edit json file screen
        let jsonString = JSON.stringify(this.state.jsonText); // TODO naredi lepši prikaz json-a
        return (
          <View style={styles.container}>
            <Text style={styles.mainTitle}>
              Json editor screen
            </Text>
            <Separator />
            <View style={styles.multiLineBtn}>
              <Button
                color="#32a852"
                title="   Save   "
                style={styles.customBtn}
                onPress={()=>this.closeJsonConfig(true)}
              />
              <Button
                color="#32a852"
                title="   Back   "
                style={styles.customBtn}
                onPress={()=>this.closeJsonConfig(false)}
              />
            </View>
            <Separator />
            <TextInput
              placeholder="Json config wll be displayed here"
              style={styles.inputMulti}
              onChangeText={this.cleanJsonText}
              value={jsonString}
              multiline={true}/>
          </View>
        );
      }
      else {  // scan screen
        let scanText = "";
        let scanStatus = "";
        if (this.state.scanRunning) {
          scanText = "Stop scan";
          scanStatus = "Scanning...";
        }
        else {
          scanText = "Start scan";
          scanStatus = "Idle";
        }

        // TODO naredi da se lahko boljše scrolla po prikazanih napravah
        // TODO ko se disconnecta naredi reconnect

        return (
          <View style={styles.container}>
            <Text style={styles.mainTitle}>
              IRNAS BLE app - UART profile
            </Text>
            <Button
              color="#32a852"
              title='Edit json string'
              onPress={()=>this.openJsonConfig()}
            />
            <Separator />
            <Button
              color="#32a852"
              title={scanText}
              onPress={()=>this.startStopScan()}
            />
            <Separator />
            <Text style={styles.title}>
              Status: {scanStatus}
            </Text>
            <Separator />
              <View>
                {this.displayResults()}
              </View>
            <Separator />
          </View>
        );
      }
    }
    else {   // connect screen
      let displayName = this.state.device.name;
      if (this.state.writeScreenActive) {  // write screen
        return(
          <View style={styles.container}>
            <Text style={styles.mainTitle}>
              Connected to {displayName}
            </Text>
            <View style={styles.multiLineBtn}>
              <Button
                color="#32a852"
                title='   Disconnect   '
                onPress={()=>this.disconnect()}
              />
              <Button
                color="#32a852"
                title='   Read logs   '
                onPress={()=>this.displayLogs()}
              />
            </View>
            <Separator />
            <ScrollView>
              <Text style={styles.title}>
                Write data to device (RX characteristic)
              </Text>
              <View style={{justifyContent: 'center', }}>
                {this.displayUartButtons()}
              </View>
              <Separator />
              <Text style={styles.sectionTitle}>
                Write custom data:
              </Text>
              <TextInput placeholder="Write string here" style={styles.input} onChangeText={this.handleWriteText}/>
              <Button
                title='Write custom string to RX char'
                onPress={()=>this.write()}
              />
            </ScrollView>
          </View>
        );
      }
      else {  // read screen
        return (
          <View style={styles.container}>
            <Text style={styles.mainTitle}>
              Connected to {displayName}
            </Text>
            <Text style={styles.title}>
              Read logs
            </Text>
            <Separator />
            <View style={styles.multiLineBtn}>
              <Button
                color="#32a852"
                title='   Disconnect   '
                onPress={()=>this.disconnect()}
              />
              <Button
                color="#32a852"
                title='   Write commands   '
                onPress={()=>this.displayLogs()}
              />
            </View>
            <Separator />
            <ScrollView>
              <Text>
                {this.state.NotifyData}
               </Text>
            </ScrollView>
          </View>
        );
      }
    }
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  title: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 5,
  },
  mainTitle: {
    fontSize: 20,
    color: '#32a852',
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.black,
    textAlign: 'center',
  },
  separator: {
    marginVertical: 8,
    borderBottomColor: '#737373',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  input: {
    height: 60,
    padding: 8,
    fontSize: 16,
    textAlign: 'center',
  },
  inputMulti: {
    padding: 8,
    fontSize: 16,
  },
  multiLineBtn: {
    flexDirection: "row",
    marginLeft: 10,
    justifyContent: 'space-evenly',
  },
});

export default App;
