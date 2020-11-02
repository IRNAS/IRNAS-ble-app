/**
 * IRNAS BLE app to communicate with Nordic UART Service profile
 * Tested with server in Nrf connect Android app and Nordic dev board PCA10040
 *
 * @format
 * @flow strict-local
 */

import React, { Component } from 'react';
import {
    StyleSheet, ScrollView, View, Text, StatusBar, Button, FlatList, Alert, RefreshControl, AppState,
    TextInput, TouchableOpacityBase, TouchableWithoutFeedbackBase, KeyboardAvoidingView, PermissionsAndroid
} from 'react-native';
import { jHeader, LearnMoreLinks, Colors, DebugInstructions, ReloadInstructions } from 'react-native/Libraries/NewAppScreen';

import { BleAndroidErrorCode, BleErrorCode, BleManager, LogLevel } from 'react-native-ble-plx';
import RNLocation from 'react-native-location';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { writeFile, readFile, readDir, DownloadDirectoryPath, DocumentDirectoryPath, mkdir, stat, statResult } from 'react-native-fs';
import { getDeviceId } from 'react-native-device-info';
import RNFileSelector from 'react-native-file-selector';
import AsyncStorage from '@react-native-community/async-storage';

import ListDeviceItem from './components/ListDeviceItem';
import UartButton from './components/UartButton';
import { EncodeBase64, DecodeBase64, NotifyMessage, ReplaceAll, GetTimestamp, GetFullTimestamp, BLE_RETRY_COUNT, IrnasGreen } from './Helpers';

//console.disableYellowBox = true;  // disable yellow warnings in the app

// TODO npm update dev branch of irnas ble app and fix bugs
// TODO NotifyData add info for which device the log belongs so, so we can keep logs between connections to multiple devices
// TODO fix connection behaving randomly sometimes
// TODO made android build process fully automatic
// TODO fix ReferenceError: Can't find variable: device (screenshot na P10)
// TODO handle back button
// TODO separate App.js into multiple files, also define some folder structure
// TODO support resetting configuration json file to default
// TODO reformat and reorganize code + start using coding standard (function and variable names)

function Separator() {
    return <View style={styles.separator} />;
}

class App extends React.Component {
    constructor() {
        super();
        this._isMounted = false;

        this.manager = new BleManager();
        this.manager.setLogLevel(LogLevel.Debug);
        this.state = {
            scanRunning: false,
            refreshingScanList: false,
            NotifyData: [],
            device: undefined,
            connectionInProgress: false,
            numOfDevices: 0,
            notificationsRunning: false,
            writeText: "",
            jsonEditActive: false,
            jsonText: "",
            jsonParsed: {},
            deviceFiltersActive: false,
            writeScreenActive: true,
            retryCount: 0,
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

    writeState(object, fun) {        // wrapper function to set state, which prevents warnings can't call setState on an unmounted component
        if (this._isMounted) {
            this.setState(object, fun);
        }
        else {
            console.log("Can't set state: ", object, fun);
        }
    }

    handleAppStateChange = (nextAppState) => {
        if (nextAppState === 'background' || nextAppState === 'inactive') {
            // save current config to app storage
            this.storeData();
            console.log('dataToSave');
        }
        else if (nextAppState === 'active') {
            this.recoverData();
            console.log("dataToLoad");
        }
        else {
            console.log("nextAppState: ", nextAppState);
        }
    };
    
    storeData = async () => {   // save latest json data
        try {
            await AsyncStorage.setItem('@jsonText', this.state.jsonText);
        } 
        catch (error) {
            console.log(error);
        }
    };
    
    recoverData = async () => {     // load latest or default json data
        try {
            const value = await AsyncStorage.getItem('@jsonText');
            //console.log(value);
            if (value !== null) {
                this.writeState({ jsonText: value}, this.cleanJsonText);  // parse json file
            }
            else {
                var data = require('./default_config.json');  // read json file
                console.log(data.commands[0]["uart_command"]);
                console.log(data.commands[1]["uart_command"]);
                this.writeState({ jsonText: JSON.stringify(data), jsonParsed: data }, this.parseJsonConfig);  // parse json file
            }
        } 
        catch(e) {
            console.log(error);
        }
    };
    
    removeData = async () => {  // delete json data from async storage
        try {
            await AsyncStorage.removeItem('@jsonText')
        } 
        catch(e) {
            console.log(error);
        }
        console.log('Done removing.')
    }
    
    componentDidMount() {
        console.log("componentDidMount");
        this._isMounted = true;
        //this.removeData();
        this.checkPermissions();  // on launch check all required permissions and start scan if OK
        AppState.addEventListener('change', this.handleAppStateChange);    // add listener for app going into background
        this.recoverData(); // get data from saved state (async storage)
    }

    componentWillUnmount() {
        console.log("componentWillUnmount");
        this._isMounted = true;
        if (this.state.device !== undefined) {
            this.disconnect();
            // TODO cancel asynchronous task (notify)
            this.notificationsOnOff();
        }
        if (this.state.scanRunning) { // stop scan if running
            this.stop();
        }
        AppState.removeEventListener('change', this.handleAppStateChange);     // remove listener for app going into background
    }

    checkPermissions() {
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

        console.log("Checking location permission");
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

        console.log("Checking storage permission");
        this.requestStoragePermission();
    }

    requestStoragePermission = async () => {
        try {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
                {
                    title: "External Storage Write Permission",
                    message:
                        "Irnas BLE App needs access to your storage " +
                        "so it can save read logs.",
                }
            );
            if (granted === PermissionsAndroid.RESULTS.GRANTED) {
                console.log("Logs can be saved to device's storage.");
            } else {
                NotifyMessage("Write to external storage permission is denied, you cannot save logs to storage!");
            }
        } catch (err) {
            console.warn(err);
        }
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
        this.writeState({ scanRunning: true });
        this.manager.startDeviceScan(null, null, (error, scannedDevice) => {
            if (error) {
                NotifyMessage("Scan error: " + JSON.stringify(error.message));
                this.writeState({ scanRunning: false });
                return;
            }
            if (scannedDevice) {
                //console.log(scannedDevice.id, ", ", scannedDevice.localName, ", ", scannedDevice.name, ", ", scannedDevice.rssi);
                //console.log(scannedDevice.name, ", ", DecodeBase64(scannedDevice.manufacturerData));
                let filterOK = true;
                if (this.state.deviceFiltersActive) { // filtering is active, check each filter
                    if (this.bleFilterName !== "") {  // device filter by name active, check if name contains desired string
                        if (scannedDevice.name === null || !scannedDevice.name.includes(this.bleFilterName)) {
                            //console.log("Device " + scannedDevice.name + " filtered out because name should be " + this.bleFilterName);
                            filterOK = false;
                        }
                    }
                    if (filterOK && this.bleFilterMac !== "") { // device filter by mac active, check if mac adresses match
                        if (scannedDevice.id === null || scannedDevice.id !== this.bleFilterMac) {
                            //console.log("Device " + scannedDevice.id + " filtered out because mac should be " + this.bleFilterMac);
                            filterOK = false;
                        }
                    }
                }

                if (filterOK) {
                    let objIndex = this.devices.findIndex(obj => obj.id == scannedDevice.id);  // seach if we already have current scanned device saved
                    if (objIndex < 0) { // new device, add to array
                        this.devices.push(scannedDevice);
                        this.writeState({ numOfDevices: this.state.numOfDevices++ })
                    } 
                    else {  // old device, update its values    // TODO handle redraw better
                        this.devices[objIndex].rssi = scannedDevice.rssi;
                        this.devices[objIndex].manufacturerData = scannedDevice.manufacturerData;
                    }   
                }
            }
        });
    }

    stop() {
        this.manager.stopDeviceScan();
        console.log("Found " + this.devices.length + " devices.");
        this.writeState({ scanRunning: false });
    }

    connectToDevice = item => {
        console.log("selected device: " + item.id + " " + item.name);
        if (this.state.scanRunning) { // stop scan if running
            this.stop();
        }
        this.connect(item);
    }

    connect(item) {
        console.log("connect()");
        const device = item;
        this.writeState({ connectionInProgress: true });
        //console.log(device);

        if (device !== undefined) {
            if (this.state.retryCount === 0) {  // only display message to user when first connect try
                NotifyMessage("connecting to device: " + device.id);
            }
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
                    this.writeState({ device: item, connectionInProgress: false }, this.notificationsOnOff);
                })
                .catch((error) => {
                    this.handleConnectError(error, device);
                });
        }
    }

    disconnect() {
        console.log("disconnect()");
        var device = this.state.device;
        if (device !== undefined) {
            this.notifyStop();
            this.manager.cancelDeviceConnection(device.id)
                .then((device) => {
                    console.log("Disconnect OK");
                    
                })
                .catch((error) => {
                    console.log(error);
                });
            this.writeState({ device: undefined, connectionInProgress: false, NotifyData: [] });
            NotifyMessage("Device was disconnected.");
        }       
    }

    handleConnectError(error, item) {
        console.log("handling connect error: ", error);
        if (error.androidErrorCode == BleAndroidErrorCode.Error) {      // generic Android BLE stack error
            let retries = this.state.retryCount;
            if (retries < BLE_RETRY_COUNT) {
                this.setState({ retryCount: ++retries });
                this.connect(item);     // connect retry
            }
            else {
                NotifyMessage("Connecting unsuccessful!");
                this.setState({ retryCount: 0, device: undefined, connectionInProgress: false });
            }
        }
        // more errors to be added
        else {      // other error - log it
            NotifyMessage("Error when connecting to selected device.");
            console.log(error.message);
            console.log(error.reason);
            console.log(error.errorCode);
            //console.log(error.attErrorCode);
            //console.log(error.androidErrorCode);
            this.setState({ retryCount: 0, device: undefined, connectionInProgress: false });
        } 
    }

    notify() {
        if (this.state.device !== undefined) {
            NotifyMessage("Turning on notifications: " + this.state.device.id.toString());
            this.setupNotifications()
                .then(() => {
                    NotifyMessage("Listening...");
                    this.writeState({ notificationsRunning: true });
                }, (error) => {
                    console.log(error.message);
                    this.writeState({ notificationsRunning: false });
                });
        }
    }

    notifyStop() {
        if (this.state.device !== undefined) {
            //NotifyMessage("Turning off notifications");
            this.writeState({ notificationsRunning: false });
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
                if (error.errorCode === BleErrorCode.DeviceDisconnected) {
                    this.disconnect();
                }
                else {
                    console.log("Notifications error:", error.message);
                    console.log("Error codes:", error.errorCode, error.androidErrorCode, error.attErrorCode);
                }
                return;
            }
            //console.log("Char monitor: " + characteristic.uuid, characteristic.value);
            const result = DecodeBase64(characteristic.value);
            //console.log(result.length);
            console.log("Received data from device: " + result);
            const stringResult = GetTimestamp() + ": " + result.toString();
            this.writeState(prevState => ({   // updater function to prevent race conditions (append new data)
                NotifyData: [...prevState.NotifyData, stringResult + "\n"]
            }));
        });
    }

    handleWriteText = text => {
        this.writeState({ writeText: text });
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
                    data={devices}
                    renderItem={({ item }) => <ListDeviceItem item_in={item} filter_name={this.bleFilterName} connectToDevice={this.connectToDevice} />}
                    refreshControl={
                        <RefreshControl
                            refreshing={this.state.refreshingScanList}
                            onRefresh={this.onScanResultRefresh.bind(this)}
                        />
                    }
                />
            );
        }
        else if (this.state.deviceFiltersActive) {  // no devices but active filters
            let filtersText = "Filtering active";
            if (this.bleFilterName !== "") {
                filtersText += "\nname: " + this.bleFilterName;
            }
            if (this.bleFilterMac !== "") {
                filtersText += "\nmac: " + this.bleFilterMac;
            }
            return (
                <View>
                    <Text style={styles.title}>No devices found yet</Text>
                    <Text style={styles.sectionTitle}>{filtersText}</Text>
                </View>
            );
        }
        else {  // No devices and no active filters
            return (
                <View>
                    <Text style={styles.title}>No devices found yet</Text>
                    <Text style={styles.sectionTitle}>No filters active</Text>
                </View>
            );
        }
    }

    onScanResultRefresh() {   // pull down on BLE devices list gesture handler
        this.devices = [];
        this.writeState({ numOfDevices: 0, refreshing: false });
        if (!this.state.scanRunning) {
            this.scan();
        }
    }

    parseJsonConfig() {
        console.log("parseJsonConfig");
        let data = this.state.jsonParsed;

        // check if json contains device filters
        if (data.device_filter !== undefined) {

            this.bleFilterName = data.device_filter.name; // name filtering
            this.bleFilterMac = data.device_filter.mac;   // mac filtering

            if (this.bleFilterName !== "" || this.bleFilterMac !== "") {
                this.writeState({ deviceFiltersActive: true });
                console.log("JSON data: found filters: " + this.bleFilterName + " " + this.bleFilterMac);
            }
            else {  // filter value fields are empty, disable filtering
                this.writeState({ deviceFiltersActive: false });
            }
        }
        else { // // json doesn't contain filter field, disable filtering
            this.writeState({ deviceFiltersActive: false });
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
        this.writeState({ jsonText: text });
    }

    cleanJsonText() {
        console.log("cleanJsonText");
        this.onScanResultRefresh();
        try {
            let parsedText = JSON.parse(this.state.jsonText);
            this.writeState({ jsonParsed: parsedText }, this.parseJsonConfig);
        }
        catch (error) {
            console.log(error);
            NotifyMessage("JSON parse error, please try again");
            this.writeState({ jsonText: this.oldJson }, this.closeJsonConfig);
        }
    }

    openJsonConfig() {
        console.log("openJsonConfig");
        if (this.state.scanRunning) { // stop scan if running
            this.stop();
        }
        this.writeState({ jsonEditActive: true });
    }

    closeJsonConfig(save) {
        console.log("closeJsonConfig");
        if (save) {
            this.cleanJsonText();
        }
        else {
            this.writeState({ jsonText: JSON.stringify(this.oldJson) });
        }
        this.writeState({ jsonEditActive: false });
    }

    exportJsonConfig() {
        if (this.state.jsonText !== 0) {
            if (Platform.OS === 'android') {
                // make a directory Irnas_BLE_files if it doesn't exist
                mkdir(DownloadDirectoryPath + "/Irnas_BLE_files")
                // prepare filename (logs + deviceName + timestamp)
                const filename = "config-" + getDeviceId() + "-" + GetFullTimestamp();
                const fullFilename = DownloadDirectoryPath + "/Irnas_BLE_files/" + filename + ".json";
                writeFile(fullFilename, this.state.jsonText, 'utf8')
                    .then((success) => {
                        NotifyMessage("Config was saved to Downloads/Irnas_BLE_files/.");
                    })
                    .catch((error) => {
                        NotifyMessage("Config file save error");
                        console.log(error.message);
                    });
            }
            else {
                Alert.alert("This feature is available only on Android OS.");
                //const DDP = DocumentDirectoryPath + "/";
            }
        }
        else { 
            NotifyMessage("Config json is empty!");
        }
    }

    importJsonConfig() {
        if (Platform.OS === 'android') {
            RNFileSelector.Show(
                {
                    title: 'Select File',
                    path: DownloadDirectoryPath,
                    onDone: (path) => {
                        console.log('File selected: ' + path);
                        // if we have a file, read it
                        readFile(path, 'utf8')
                            .then((contents) => {
                                // log the file contents
                                //console.log(contents);
                                NotifyMessage("Config read OK");
                                this.writeState({ jsonText: contents });
                            })
                            .catch((err) => {
                                NotifyMessage("Config file read error");
                                console.log(err.message, err.code);
                            });
                    },
                    onCancel: () => {
                        console.log('Cancelled');
                    }
                }
            )
        }
        else {
            Alert.alert("This feature is available only on Android OS.");
            //const DDP = DocumentDirectoryPath + "/";
        }
    }

    displayUartButtons() {
        const views = [];
        var command;
        for (command of this.uartCommands) {
            views.push(<UartButton key={command.name} title={command.name} uart_command={command.uart_command} writeUartCommand={this.writeUartCommand} />)
        }
        return views;
    }

    writeUartCommand = uart => {
        console.log('button clicked, writing command: ' + uart);
        this.writeState({ writeText: uart }, this.write);
    }

    displayLogs() {
        if (this.state.writeScreenActive) {
            this.writeState({ writeScreenActive: false });
        }
        else {
            this.writeState({ writeScreenActive: true });
        }
    }

    clearLog() {
        this.writeState({ NotifyData: [] });
    }

    saveLog() {
        if (this.state.NotifyData.length !== 0) {
            if (Platform.OS === 'android') {
                // make a directory Irnas_BLE_files if it doesn't exist
                mkdir(DownloadDirectoryPath + "/Irnas_BLE_files")
                // prepare filename (logs + deviceName + timestamp)
                const deviceName = this.state.device.name;
                if (deviceName === "null") {
                    deviceName = "NoName";
                }
                const filename = "logs-" + deviceName + "-" + GetFullTimestamp();
                const fullFilename = DownloadDirectoryPath + "/Irnas_BLE_files/" + filename + ".txt";
                writeFile(fullFilename, "," + this.state.NotifyData.toString(), 'utf8')
                    .then((success) => {
                        NotifyMessage("File was saved to Downloads/Irnas_BLE_files/.");
                    })
                    .catch((error) => {
                        NotifyMessage("File save error");
                        console.log(error.message);
                    });
            }
            else {
                Alert.alert("This feature is available only on Android OS.");
                //const DDP = DocumentDirectoryPath + "/";
            }
        }
        else {  // no logs yet
            NotifyMessage("There are no logs available yet.");
        }
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
                                    color={IrnasGreen}
                                    title="Save"
                                    style={styles.customBtn}
                                    onPress={() => this.closeJsonConfig(true)}
                                />
                            </View>
                            <View style={styles.multiLineView}>
                                <Button
                                    color={IrnasGreen}
                                    title="Back"
                                    style={styles.customBtn}
                                    onPress={() => this.closeJsonConfig(false)}
                                />
                            </View>
                        </View>
                        <View style={styles.multiLineViewMain}>
                            <View style={styles.multiLineView}>
                                <Button
                                    color={IrnasGreen}
                                    title="Import"
                                    style={styles.customBtn}
                                    onPress={() => this.importJsonConfig()}
                                />
                            </View>
                            <View style={styles.multiLineView}>
                                <Button
                                    color={IrnasGreen}
                                    title="Export"
                                    style={styles.customBtn}
                                    onPress={() => this.exportJsonConfig()}
                                />
                            </View>
                        </View>
                        <Separator />
                        <KeyboardAwareScrollView>
                            <TextInput
                                placeholder="Json config wll be displayed here"
                                style={styles.inputMulti}
                                onChangeText={this.changeJsonText}
                                value={this.state.jsonText}
                                multiline={true} />
                        </KeyboardAwareScrollView>
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
                    if (this.state.connectionInProgress) {
                        scanStatus = "Connecting...";
                    }
                    else {
                        scanStatus = "Idle";
                    }
                }

                return (
                    <View style={styles.container}>
                        <Text style={styles.mainTitle}>
                            IRNAS BLE app
                        </Text>
                        <View style={styles.multiLineViewMain}>
                            <View style={styles.multiLineView}>
                            <Button
                                color={IrnasGreen}
                                title={scanText}
                                onPress={() => this.startStopScan()}
                            />
                            </View>
                            <View style={styles.multiLineView}>
                                <Button
                                color={IrnasGreen}
                                title='Edit configuration'
                                onPress={() => this.openJsonConfig()}
                                />
                            </View>
                        </View>
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
                return (
                    <View style={styles.container}>
                        <Text style={styles.mainTitle}>
                            Connected to {displayName}
                        </Text>
                        <View style={styles.multiLineViewMain}>
                            <View style={styles.multiLineView}>
                                <Button
                                    color={IrnasGreen}
                                    title='Disconnect'
                                    onPress={() => this.disconnect()}
                                />
                            </View>
                            <View style={styles.multiLineView}>
                                <Button
                                    color={IrnasGreen}
                                    title='Read logs'
                                    onPress={() => this.displayLogs()}
                                />
                            </View>
                        </View>
                        <Separator />
                        <KeyboardAwareScrollView>
                            <Text style={styles.title}>
                                Write data to device (RX characteristic)
                            </Text>
                            <View style={{ justifyContent: 'center', }}>
                                {this.displayUartButtons()}
                            </View>
                            <Separator />
                            <View style = {{ marginHorizontal: 10, alignContent: 'center', }}>
                                <Button
                                    title='Send custom data to RX char'
                                    onPress={() => this.write()}
                                />
                            </View>
                            <TextInput
                                placeholder="Write custom string here"
                                style={styles.input}
                                onChangeText={this.handleWriteText}
                                onSubmitEditing={() => this.write()}
                            />
                        </KeyboardAwareScrollView>
                    </View>
                );
            }
            else {  // read screen
                let logs = this.state.NotifyData;
                if (logs.length === 0) {
                    logs = "No logs yet";
                }

                return (
                    <View style={styles.container}>
                        <Text style={styles.mainTitle}>
                            Connected to {displayName}
                        </Text>
                        <View style={styles.multiLineViewMain}>
                            <View style={styles.multiLineView}>
                                <Button
                                    color={IrnasGreen}
                                    title='Disconnect'
                                    onPress={() => this.disconnect()}
                                />
                            </View>
                            <View style={styles.multiLineView}>
                                <Button
                                    color={IrnasGreen}
                                    title='Write commands'
                                    onPress={() => this.displayLogs()}
                                />
                            </View>
                            <View style={styles.multiLineView}>
                                <Button
                                    color={IrnasGreen}
                                    title='Clear logs'
                                    buttonStyle={styles.multiLineBtn}
                                    onPress={() => this.clearLog()}
                                />
                            </View>
                            <View style={styles.multiLineView}>
                                <Button
                                    color={IrnasGreen}
                                    title='Save logs'
                                    buttonStyle={styles.multiLineBtn}
                                    onPress={() => this.saveLog()}
                                />
                            </View>
                        </View>
                        <Separator />
                        <Text style={styles.title}>
                            Read logs
                        </Text>
                        <ScrollView
                            ref={ref => this.scrollView = ref}
                            onContentSizeChange={(contentWidth, contentHeight) => {
                                this.scrollView.scrollResponderScrollToEnd({ animated: true });
                            }}>
                            <Text>{logs}</Text>
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
        color: IrnasGreen,
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
        paddingBottom: 70,
        marginBottom: 70,
    }
});

export default App;
