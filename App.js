/**
 * IRNAS BLE app to communicate with Nordic UART Service profile
 * Tested with server in Nrf connect Android app
 *
 * @format
 * @flow strict-local
 */

import React, { Component } from 'react';
import { StyleSheet, ScrollView, View, Text, StatusBar, Button, FlatList, Alert, TextInput } from 'react-native';
import { jHeader, LearnMoreLinks, Colors, DebugInstructions, ReloadInstructions } from 'react-native/Libraries/NewAppScreen';

import { BleManager, LogLevel } from 'react-native-ble-plx';

import ListDeviceItem from './components/ListDeviceItem';
import { EncodeBase64, DecodeBase64, NotifyMessage }  from './Helpers';

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
      NotifyData: 0,
      device: undefined,
      numOfDevices: 0,
      notificationsRunning: false,
      writeText: "",
    };
    this.devices = [];
    this.services = {};

    this.uartService = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";
    this.uartRx = "6E400002-B5A3-F393-E0A9-E50E24DCCA9E";   // write
    this.uartTx = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E";   // notify
  }

  componentWillUnmount() {
    if (this.state.device !== undefined) {
      this.disconnect();
      // TODO cancel asynchronous task (notify)
    }
  }

  checkBLE() {
    console.log("Checking Bluetooth");
    const subscription = this.manager.onStateChange((state) => {
      if (state === 'PoweredOn') {
        NotifyMessage("Bluetooth OK");
        subscription.remove();
      } else {
        NotifyMessage("Bluetooth not OK, state: " + state.toString());
        subscription.remove();
      }
    }, true);
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
    this.setState({device: item});
    //console.log(device);

    if (device !== undefined) {
      NotifyMessage("connecting to device: ", device.id);
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
      })
      .catch ((error) => {
        NotifyMessage("Error when connecting to selected device.");
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
      NotifyMessage("Turning off notifications");
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
        console.log(error.message);
        return;
      }
      //console.log("Char monitor: " + characteristic.uuid, characteristic.value);
      const result = DecodeBase64(characteristic.value);
      //console.log(result.length);
      //console.log("HR: " + result[0] + " " + result[1])
      this.setState({NotifyData: result[1]});
    });
  }

  handleWriteText = text => {
    this.setState({ writeText: text});
  }

  write() {
    //device.writeCharacteristicWithoutResponseForService(this.nordicUartService, this.uartRx, "heh")
    const encoded = EncodeBase64([1]);  // default send array [1]
    if (this.state.writeText) {   // if user write data send that
      encoded = EncodeBase64(this.state.writeText);
    }

    this.state.device.writeCharacteristicWithoutResponseForService(this.uartService, this.uartRx, encoded)
    .then(() => {
      NotifyMessage("Write ok...")
    }, (error) => {
      console.log(error.message);
    })
  }

  read() {
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

  render() {
    let deviceResults = this.displayResults();  // TODO naredi da se lahko scrolla po njih
    // scan screen
    if (this.state.device === undefined) {
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
            BLE react test app - UART profile
          </Text>
          <Button
            color="#32a852"
            title='check Bluetooth'
            onPress={()=>this.checkBLE()}
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
                {deviceResults}
            </View>
          <Separator />
        </View>
      );
    }
    // connect screen
    else {
      let displayName = this.state.device.name;
      let notify  = this.state.notificationsRunning;
      let notifyText = "";
      let hrText = "";
      if (notify) {
        notifyText = "turn off notifications";
        hrText = this.state.NotifyData;
      }
      else {
        notifyText = "turn on notifications";
        hrText = "??";
      }
      if (displayName === null) {
        displayName = this.state.device.id;
      }
      return(
        <View style={styles.container}>
          <Text style={styles.mainTitle}>
            Connected to {displayName}
          </Text>
          <Separator />
          <Button
            color="#32a852"
            title='Disconnect'
            onPress={()=>this.disconnect()}
          />
          <Separator />
          <Button
            color="#32a852"
            title='Display all services'
            onPress={()=>this.displayAllServices()}
          />
          <Separator />
          <Button
            color="#32a852"
            title={notifyText}
            onPress={()=>this.notificationsOnOff()}
          />
          <Separator />
          <TextInput placeholder="String to write" style={styles.input} onChangeText={this.handleWriteText}/>
          <Button
            color="#32a852"
            title='Write to RX characteristic'
            onPress={()=>this.write()}
          />
          <Separator />
          <Button
            color="#32a852"
            title='Read from TBA'
            onPress={()=>this.read()}
          />
          <Separator />
          <Text style={styles.sectionTitle}>
            Notify message: {hrText}
          </Text>
        </View>
      );
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
    marginVertical: 5,
  },
  mainTitle: {
    fontSize: 20,
    color: '#32a852',
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 15,
  },
  sectionTitle: {
    fontSize: 24,
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
});

export default App;
