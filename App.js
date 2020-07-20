/**
 * IRNAS BLE app to communicate with Nordic UART Service profile
 * Tested with server in Nrf connect Android app and Nordic dev board PCA10040
 *
 * @format
 * @flow strict-local
 */

import React, { Component } from 'react';
import { StyleSheet, ScrollView, View, Text, StatusBar, Button, FlatList, Alert,
  TextInput, TouchableOpacityBase, TouchableWithoutFeedbackBase, KeyboardAvoidingView } from 'react-native';
import { jHeader, LearnMoreLinks, Colors, DebugInstructions, ReloadInstructions } from 'react-native/Libraries/NewAppScreen';

import { BleManager, LogLevel } from 'react-native-ble-plx';
import RNLocation from 'react-native-location';

import ListDeviceItem from './components/ListDeviceItem';
import UartButton from './components/UartButton';
import { EncodeBase64, DecodeBase64, NotifyMessage, ReplaceAll, GetTimestamp }  from './Helpers';

//console.disableYellowBox = true;  // disable yellow warnings in the app

// TODO NotifyData dodaj informacijo keri device je, da lahko ohranjaš read loge
// TODO ko se disconnecta naredi reconnect
// TODO ko se tipkovnica odpre v json configu, naredi da se ostali del ekrana scala na preostali fraj plac
// TODO avtomatiziraj celoten build proces za android
// TODO swipe down to clear scan results + restart scan
// TODO fix ReferenceError: Can't find variable: device (screenshot na P10)

function Separator() {
  return <View style={styles.separator} />;
}

class App extends React.Component {
  constructor() {
    super();
    this.manager = new BleManager();
    this.manager.setLogLevel(LogLevel.Debug);
    this.state = {
      scanRunning: false,
      NotifyData: [],
      device: undefined,
      numOfDevices: 0,
      notificationsRunning: false,
      writeText: "",
      jsonEditActive: false,
      jsonText: "",
      jsonParsed: {},
      deviceFiltersActive: false,
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
    this.checkBLE();  // on launch check BLE and start scan if OK

    var data = require('./Test.json');
    //console.log(data);
    this.setState({jsonText: JSON.stringify(data), jsonParsed: data}, this.parseJsonConfig);

  }

  componentWillUnmount() {
    if (this.state.device !== undefined) {
      this.disconnect();
      // TODO cancel asynchronous task (notify)
      this.notificationsOnOff();
    }
    if (this.state.scanRunning) { // stop scan if running
      this.stop();
    }
  }

  checkBLE() {
    console.log("Checking Bluetooth");
    const subscription = this.manager.onStateChange((state) => {
      if (state === 'PoweredOn') {
        NotifyMessage("Bluetooth is OK");
        subscription.remove();
        this.scan();
      } else {
        NotifyMessage("Bluetooth is " + state.toString());
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

        // device filter by name active, check if name contains desired string
        let filterOK = true;
        if (this.bleFilterName !== "") {
          if (scannedDevice.name === null || !scannedDevice.name.includes(this.bleFilterName)) {
            console.log("Device " + scannedDevice.id + " filtered out because name is " + scannedDevice.name);
            filterOK = false;
          }
        }
        if (filterOK) {
          console.log("filter OK");
          let containsDevice = false;
          for (device of this.devices) {
            if (device.id === scannedDevice.id) {
              containsDevice = true;
              console.log("contains device");
              break;
            }
          }
          if (!containsDevice) {
            console.log("new device being added");
            this.devices.push(scannedDevice);
            this.setState({numOfDevices: this.state.numOfDevices++})
          }
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
    if (this.state.scanRunning) { // stop scan if running
      this.stop();
    }
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
        this.setState({NotifyData: []});
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
    if (devices.length > 0) { // show devices found
      return (
        <FlatList
                data = {devices}
                renderItem={({ item }) => <ListDeviceItem item_in={item} connectToDevice={this.connectToDevice} />}
              />
        );
    }
    else if (this.state.deviceFiltersActive) {  // no devices but active filters
      let filtersText = "";
      if (this.bleFilterName !== "") {
        filtersText += " name: " + this.bleFilterName;
      }
      if (this.bleFilterMac !== "") {
        filtersText += " mac: " + this.bleFilterMac;
      }
      return (
        <View>
          <Text style={styles.title}>No devices found yet</Text>
          <Text style={styles.title}>Active filters:</Text>
          <Text style={styles.sectionTitle}>{filtersText}</Text>
        </View>
      );
    }
    else {  // No devices and no active filters
      return (
        <View>
          <Text style={styles.title}>No devices found yet</Text>
          <Text style={styles.title}>No filters active</Text>
        </View>
      );
    }
  }

  parseJsonConfig() {
    console.log("parseJsonConfig");
    let data = this.state.jsonParsed;

    // check if json contains device filters
    if (data.device_filter !== undefined) {

      this.bleFilterName = data.device_filter.name; // name filtering
      // TODO use mac filtering

      if (this.bleFilterName !== "" || this.bleFilterMac !== "") {
        this.setState({deviceFiltersActive: true});
        console.log("JSON data: found filters: " + this.bleFilterName + " " + this.bleFilterMac);
      }
      else {  // filter value fields are empty, disable filtering
        this.setState({deviceFiltersActive: false});
      }
    }
    else { // // json doesn't contain filter field, disable filtering
      this.setState({deviceFiltersActive: false});
    }

    // check if device contains commands
    if (data.commands !== undefined) {
      console.log("JSON data: found " + data.commands.length + " commands.");
      this.uartCommands = data.commands;
    }

    this.oldJson = data;
    NotifyMessage("JSON parsed OK");
  }

  changeJsonText = text => {
    console.log("changeJsonText");
    this.setState({ jsonText: text});
  }

  cleanJsonText() {
    console.log("cleanJsonText");
    try {
      let parsedText = JSON.parse(this.state.jsonText);
      this.setState({ jsonParsed: parsedText}, this.parseJsonConfig);
    }
    catch (error) {
      console.log(error);
      NotifyMessage("JSON parse error, please try again");
      this.setState({ jsonText: this.oldJson });
    }
  }

  openJsonConfig() {
    console.log("openJsonConfig");
    if (this.state.scanRunning) { // stop scan if running
      this.stop();
    }
    this.setState({ jsonEditActive: true});
  }

  closeJsonConfig(save) {
    console.log("closeJsonConfig");
    if (save) {
      this.cleanJsonText();
      //this.parseJsonConfig();
    }
    else {
      this.setState({ jsonText: JSON.stringify(this.oldJson)});
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

  clearLog() {
    this.setState({ NotifyData: [] });
  }

  saveLog() {
    // TODO save to file
    NotifyMessage("TBA");
  }

  render() {
    if (this.state.device === undefined) {
      if (this.state.jsonEditActive) {  // edit json file screen
        return (
          <View style={styles.container}>
            <Text style={styles.mainTitle}>
              Json editor screen
            </Text>
            <View style={styles.multiLineViewMain}>
              <View style={styles.multiLineView}>
                <Button
                  color="#32a852"
                  title="Save"
                  style={styles.customBtn}
                  onPress={()=>this.closeJsonConfig(true)}
                />
              </View>
              <View style={styles.multiLineView}>
                <Button
                  color="#32a852"
                  title="Back"
                  style={styles.customBtn}
                  onPress={()=>this.closeJsonConfig(false)}
                />
              </View>
            </View>
            <Separator />
            <TextInput
              placeholder="Json config wll be displayed here"
              style={styles.inputMulti}
              onChangeText={this.changeJsonText}
              value={this.state.jsonText}
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

        return (
          <View style={styles.container}>
            <Text style={styles.mainTitle}>
              IRNAS BLE app
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
              <View style={styles.displayDevices}>
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
            <View style={styles.multiLineViewMain}>
              <View style={styles.multiLineView}>
                <Button
                  color="#32a852"
                  title='Disconnect'
                  onPress={()=>this.disconnect()}
                />
              </View>
              <View style={styles.multiLineView}>
                <Button
                  color="#32a852"
                  title='Read logs'
                  onPress={()=>this.displayLogs()}
                />
              </View>
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
            <View style={styles.multiLineViewMain}>
              <View style={styles.multiLineView}>
                <Button
                  color="#32a852"
                  title='Disconnect'
                  onPress={()=>this.disconnect()}
                />
              </View>
              <View style={styles.multiLineView}>
                <Button
                  color="#32a852"
                  title='Write commands'
                  onPress={()=>this.displayLogs()}
                />
              </View>
              <View style={styles.multiLineView}>
                <Button
                  color="#32a852"
                  title='Clear logs'
                  buttonStyle={styles.multiLineBtn}
                  onPress={()=>this.clearLog()}
                />
              </View>
              <View style={styles.multiLineView}>
                <Button
                  color="#32a852"
                  title='Save logs'
                  buttonStyle={styles.multiLineBtn}
                  onPress={()=>this.saveLog()}
                />
              </View>
            </View>
            <Separator />
            <Text style={styles.title}>
              Read logs
            </Text>
            <ScrollView
              ref={ref => this.scrollView = ref}
              onContentSizeChange={(contentWidth, contentHeight)=>{
                  this.scrollView.scrollResponderScrollToEnd({animated: true});
              }}>
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
  multiLineViewMain: {
    flexWrap: 'wrap',
    flexDirection: 'row',
  },
  multiLineView: {
    marginBottom: 5,
    marginHorizontal: 3,
    width: '48%',
  },
  displayDevices: {
    paddingBottom: 100,
    marginBottom: 100,
  }
});

export default App;
