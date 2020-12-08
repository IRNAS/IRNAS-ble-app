/**
 * Smart Parks App to communicate with trackers
 * Using React Native with react-native-ble-plx library
 * Copyright (C) 2020 Vid Rajtmajer <vid@irnas.eu>, Irnas d.o.o.
 *
 * @format
 * @flow strict-local
 */

import React, { Component } from 'react';
import {
    StyleSheet, ScrollView, View, StatusBar, Button, FlatList, Alert, RefreshControl, AppState,
    TextInput, TouchableOpacityBase, TouchableWithoutFeedbackBase, KeyboardAvoidingView, PermissionsAndroid
} from 'react-native';
import { jHeader, LearnMoreLinks, Colors, DebugInstructions, ReloadInstructions } from 'react-native/Libraries/NewAppScreen';

import { BleAndroidErrorCode, BleErrorCode, BleManager, LogLevel, State } from 'react-native-ble-plx';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { writeFile, readFile, readDir, DownloadDirectoryPath, DocumentDirectoryPath, mkdir, stat, statResult } from 'react-native-fs';
import { getDeviceId } from 'react-native-device-info';
import RNLocation from 'react-native-location';
import RNFileSelector from 'react-native-file-selector';
import AsyncStorage from '@react-native-community/async-storage';
import { Container, Header, Content, Card, CardItem, Body, Text, Left, Right, Picker, Item, Form, ListItem, Label, Input } from 'native-base';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
//import Geolocation from 'react-native-geolocation-service';

import UartButton from './components/UartButton';
import ScanDeviceCard from './components/ScanDeviceCard';
import { 
    EncodeBase64, DecodeBase64, NotifyMessage, GetTimestamp, GetFullTimestamp, EncodeTrackerSettings, DecodeTrackerSettings, initialStatus, packUintToBytes, 
    GenerateSettingsLookupTable, darkBackColor, lightBackColor, mtuSize, BLE_RETRY_COUNT, chargingTreshold, DecodeStatusMessage, statusMessageCommand,
    statusSendIntervalCommand, loraSendIntervalCommand, rebootCommand, validPickerIntervalValues, bleScanTimeout, trackerScanOptions, hwTypeEnum
} from './Helpers';
import { Value } from 'react-native-reanimated';


//console.disableYellowBox = true;  // disable yellow warnings in the app

// TRACKER STUFF:
// TODO device settings fetch from github (get all tags)
// TODO check port when receiving message from tracker

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
            bluetoothPopupHappened: false,
            scanRunning: false,
            refreshingScanList: false,
            NotifyData: [],
            statusData: undefined,
            devices: [],
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
            deviceCommands: [],
            retryCount: 0,
            pickerLoraSelected: validPickerIntervalValues[0],
            pickerStatusSelected: validPickerIntervalValues[0],
            latestPosition: [],
        };
        this.services = {};

        this.uartService = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";
        this.uartRx = "6E400002-B5A3-F393-E0A9-E50E24DCCA9E";   // write
        this.uartTx = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E";   // notify

        this.bleFilterName = "";
        this.bleFilterMac = "";

        this.oldJson = {};
        this.logScreenDisabled = true;
        this.scanTimeout = undefined;
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
            //this.storeData();     // TEST
            console.log('TODO dataToSave');
        }
        if (nextAppState === 'active') {
            this.recoverData();
            console.log("dataToLoad");
        }
        //console.log("nextAppState: ", nextAppState);
    };

    enableBluetooth() { // Android only
        this.manager.enable()
            .then(() => {
                console.log("bluetooth enabled");
                
            });
    }
    
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
            //const value = await AsyncStorage.getItem('@jsonText');
            const value = null;     // TEST
            console.log("async storage json text: ", value);
            
            if (value !== null) {
                this.writeState({ jsonText: value}, this.cleanJsonText);  // parse json file
            }
            else {
                let data = require('./default_config.json');  // read json file
                console.log(data.commands[0]["uart_command"]);
                console.log(data.commands[1]["uart_command"]);
                this.writeState({jsonText: JSON.stringify(data), jsonParsed: data }, this.cleanJsonText);  // parse json file
            }
        }
        catch(error) {
            console.log(error);
        }
    };
    
    removeData = async () => {  // delete json data from async storage
        try {
            await AsyncStorage.removeItem('@jsonText');
        } 
        catch(error) {
            console.log(error);
        }
        console.log('Done removing.');
    }
    
    componentDidMount() {
        console.log("componentDidMount");
        this._isMounted = true;
        //this.removeData();    // TEST
        this.checkPermissions();  // on launch check all required permissions
        AppState.addEventListener('change', this.handleAppStateChange);    // add listener for app going into background
        this.recoverData(); // get data from saved state (async storage) or load defaults
        //this.writeState({device: "heh"});       // TEST
    }

    componentWillUnmount() {
        console.log("componentWillUnmount");
        this._isMounted = false;
        if (this.state.device !== undefined) {
            this.disconnect();
            this.notificationsOnOff();
        }
        this.stopScan();    // stop scan if running
        if (this.state.monitorDevConnSubscription !== undefined) {
            this.state.monitorDevConnSubscription.remove();
        }
        this.writeState({ bluetoothPopupHappened: false, monitorDevConnSubscription: undefined });
        AppState.removeEventListener('change', this.handleAppStateChange);     // remove listener for app going into background
    }

    checkPermissions() {
        console.log("Checking Bluetooth");
        const subscription = this.manager.onStateChange((state) => {
            if (state == State.PoweredOn) {
                console.log("Bluetooth permission OK");
                subscription.remove();
            }
            else if (state == State.PoweredOff) {
                this.enableBluetooth();
            }
            else {
                NotifyMessage("Bluetooth is " + state.toString());
            }
        }, true);

        console.log("Checking location permission");
        RNLocation.configure({
            distanceFilter: 100, // Meters
            desiredAccuracy: {
                ios: "best",
                android: "balancedPowerAccuracy"
            },
            // Android only
            androidProvider: "auto",
            interval: 5000, // Milliseconds
            fastestInterval: 10000, // Milliseconds
            maxWaitTime: 5000, // Milliseconds
            // iOS Only
            activityType: "other",
            allowsBackgroundLocationUpdates: false,
            headingFilter: 1, // Degrees
            headingOrientation: "portrait",
            pausesLocationUpdatesAutomatically: false,
            showsBackgroundLocationIndicator: false,
        });

        RNLocation.requestPermission({
            ios: "whenInUse",
            android: {
                detail: "fine"       // "coarse"
            }
        })
        .then(granted => {
            if (granted) {
                console.log("Location permission OK");
                this.writeState({ locationPermissionAllowed: true });
                this.locationSubscription = RNLocation.subscribeToLocationUpdates(locations => { 
                    //console.log(locations);
                    let latitude = locations[0].latitude;
                    let longitude = locations[0].longitude;
                    if (longitude !== undefined && latitude !== undefined) {
                        let position = [parseInt(longitude * Math.pow(10,7)), parseInt(latitude * Math.pow(10,7))];
                        this.writeState({ latestPosition: position });
                    }
                });
            }
            else {
                NotifyMessage("Location access must be granted in order to scan for trackers!");
                this.writeState({ locationPermissionAllowed: false });
            }
        });

        console.log("Checking storage permission");
        this.requestStoragePermission();        // TODO this is called only on the second time fresh installed app is launched
    }

    requestStoragePermission = async () => {
        try {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
                {
                    title: "External Storage Write Permission",
                    message:
                        "The app needs access to your storage " +
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
            this.stopScan();
        }
        else if (this.state.connectionInProgress) {     // if we are connecting to device
            console.log("Canceling device connection");
            this.manager.cancelDeviceConnection(this.state.device.id)
                .then(() => {
                    this.writeState({ retryCount: 0, device: undefined, connectionInProgress: false });
                })
                .catch((error) => {
                    console.log("cancelDeviceConnection error: ", error);
                });
        }
        else {  // scan is not running
            this.startScan();
        }
    }

    startScan() {
        if (!this.state.bluetoothPopupHappened) {
            this.writeState({ bluetoothPopupHappened: true });
            this.enableBluetooth();
        }
        this.startScanTimeoutTimer();
        this.writeState({ scanRunning: true });
        this.manager.startDeviceScan(null, trackerScanOptions, (error, scannedDevice) => {
            if (error) {
                NotifyMessage("Scan error: " + JSON.stringify(error.message));
                this.writeState({ scanRunning: false });
                this.stopScanTimeoutTimer();
                return;
            }
            // when scan result is received
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
                    if (filterOK && this.bleFilterMac !== "") { // device filter by mac active, check if mac addresses match
                        if (scannedDevice.id === null || scannedDevice.id !== this.bleFilterMac) {
                            //console.log("Device " + scannedDevice.id + " filtered out because mac should be " + this.bleFilterMac);
                            filterOK = false;
                        }
                    }
                }

                if (filterOK) {
                    let objIndex = this.state.devices.findIndex(obj => obj.id == scannedDevice.id);  // search if we already have current scanned device saved
                    if (objIndex < 0) { // new device, add to array
                        this.writeState(prevState => ({ devices: [...prevState.devices, scannedDevice]}));
                        //this.devices.push(scannedDevice);
                        this.writeState({ numOfDevices: this.state.numOfDevices++ })
                    } 
                    else {  // old device, update its values
                        let items = [...this.state.devices];
                        let item = {... items[objIndex]};
                        item.rssi = scannedDevice.rssi;
                        item.manufacturerData = scannedDevice.manufacturerData;
                        items[objIndex] = item;
                        this.writeState({devices: items});
                    }   
                }
            }
        });
    }

    stopScan() {
        if (this.state.scanRunning) {
            this.manager.stopDeviceScan();
        }
        this.stopScanTimeoutTimer();
        //console.log("Found " + this.state.devices.length + " devices.");
        this.writeState({ scanRunning: false });
    }

    stopScanTimeoutTimer() {
        if (this.scanTimeout) {
            console.log("scan timeout");
            clearTimeout(this.scanTimeout);
        }
        this.scanTimeout = undefined;
    }

    startScanTimeoutTimer() {
        this.stopScanTimeoutTimer();    // stop timer if running
        const that = this;
        this.scanTimeout = setTimeout(() => {
                that.stopScan();
            }, bleScanTimeout);
    }

    connectToDevice = item => {
        console.log("selected device: " + item.id + " " + item.name);
        this.stopScan();    // stop scan if running
        this.connect(item);
    }

    connect(item) {
        console.log("connect()");
        let dev = item;
        if (dev !== undefined) {
            this.writeState({ connectionInProgress: true, device: dev });
            if (this.state.retryCount === 0) {  // only display message to user when first connect try
                NotifyMessage("connecting to device: " + dev.id);
            }
            this.manager.connectToDevice(dev.id)
                .then((dev) => {     // increase MTU to match the tracker buffer size
                    console.log("MTU");
                    return dev.requestMTU(mtuSize);
                })
                .then((dev) => {
                    //let allCharacteristics = device.discoverAllServicesAndCharacteristics()
                    //console.log("chars: ");
                    //console.log(allCharacteristics)
                    //console.log(allCharacteristics)
                    console.log("discoverServices");
                    return dev.discoverAllServicesAndCharacteristics();
                })
                .then((dev) => {
                    console.log("save services");
                    let services = dev.services(dev.id);
                    return services;
                })
                .then((services) => {
                    console.log("found services");
                    this.services = services;
                    NotifyMessage("Connect OK");
                    //this.writeState({ device: dev, connectionInProgress: false }, 
                    this.writeState({ connectionInProgress: false },
                        () => {
                            this.notificationsOnOff();
                            this.parseCmdCommands();
                            this.monitorDeviceConnection();
                        }
                    )
                })
                .catch((error) => {
                    this.handleConnectError(error, dev);
                });
        }
    }

    disconnect() {
        console.log("disconnect()");
        let dev = this.state.device;
        if (dev !== undefined) {
            this.notifyStop();      // stop notifications from device
            if (this.state.monitorDevConnSubscription !== undefined) {
                this.state.monitorDevConnSubscription.remove();
            }
            this.manager.cancelDeviceConnection(dev.id)  // perform disconnect
                .then(() => {
                    console.log("Disconnect OK");
                })
                .catch((error) => {
                    console.log(error);
                });
            this.writeState({ device: undefined, connectionInProgress: false, NotifyData: [] });
            NotifyMessage("Device was disconnected.");
        }
    }

    monitorDeviceConnection() {
        let dev = this.state.device;
        let subscription = this.manager.onDeviceDisconnected(dev.id, (error, device) => {
            if (error === null) {   // device got disconnected from the app
                console.log("Device got disconnected");
                this.disconnect();
            }
            else {  // some error happened
                console.log("%s disconnected: %s, reason: %s", device, error);
                this.writeState({ device: undefined, connectionInProgress: false, NotifyData: [], monitorDevConnSubscription: undefined });
            }
        });
        console.log("monitorDeviceConnection subscription: ", subscription);
        this.writeState({monitorDevConnSubscription: subscription});
    }

    handleConnectError(error, item) {
        console.log("handling connect error: ", error);
        if (error.androidErrorCode == BleAndroidErrorCode.Error) {      // generic Android BLE stack error
            let retries = this.state.retryCount;
            if (retries < BLE_RETRY_COUNT) {
                this.writeState({ retryCount: ++retries });
                this.connect(item);     // connect retry
            }
            else {
                NotifyMessage("Connecting unsuccessful!");
                this.writeState({ retryCount: 0, device: undefined, connectionInProgress: false });
            }
        }
        else if (error.errorCode == BleErrorCode.DeviceAlreadyConnected) {
            console.log("Device was already connected");
            this.writeState({ retryCount: 0, device: item, connectionInProgress: false });
        }
        else if (error.errorCode = BleErrorCode.OperationCancelled) {   // connection operation was canceled by user
            console.log("Connection canceled");
            this.writeState({ retryCount: 0, device: item, connectionInProgress: false });
        }
        // more errors to be added
        else {      // other error - log it
            NotifyMessage("Error when connecting to selected device.");
            console.log(error.message);
            console.log(error.reason);
            console.log(error.errorCode);
            //console.log(error.attErrorCode);
            //console.log(error.androidErrorCode);
            this.writeState({ retryCount: 0, device: undefined, connectionInProgress: false });
        }
    }

    notify() {
        if (this.state.device !== undefined) {
            console.log("Turning on notifications: " + this.state.device.id.toString());
            NotifyMessage("Please wait for device to load the latest status data...");
            this.setupNotifications()
                .then(() => {
                    console.log("Notifications turned on");
                    this.writeState({ notificationsRunning: true }, this.refreshData());
                }, (error) => {
                    NotifyMessage("Error when turning on notifications for the tracker!");
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
        let dev = this.state.device;
        if (dev && dev !== undefined) {
            this.manager.monitorCharacteristicForDevice(dev.id, this.uartService, this.uartTx, (error, characteristic) => {
                if (error) {
                    if (error.errorCode === BleErrorCode.DeviceDisconnected) {
                        this.disconnect();
                    }
                    else {
                        console.log("Notifications error: %s, reason: %s", error.message, error.reason);
                        console.log("Error codes:", error.errorCode, error.androidErrorCode, error.attErrorCode);
                    }
                    return;
                }
                //console.log("Char monitor: " + characteristic.uuid, characteristic.value);
                let result = DecodeBase64(characteristic.value);
                let resultDecodedRaw = new Uint8Array(result);
                console.log("Received data from device (raw): " + resultDecodedRaw);
                let resultDecoded = DecodeTrackerSettings(resultDecodedRaw.buffer);
                let stringResult = null;
                if (resultDecoded !== null) {
                    console.log(resultDecoded);
                    if (resultDecoded[0] == "msg_status") {
                        this.writeState({statusData: resultDecoded[1]});
                    }
                    else if (resultDecoded[0] == "lr_send_interval") {
                        let receivedLoraInterval = resultDecoded[1].toString();
                        if (validPickerIntervalValues.includes(receivedLoraInterval)) {
                            this.writeState({pickerLoraSelected: receivedLoraInterval});
                        }
                    }
                    else if (resultDecoded[0] == "status_send_interval") {
                        let receivedStatusInterval = resultDecoded[1].toString();
                        if (validPickerIntervalValues.includes(receivedStatusInterval)) {
                            this.writeState({pickerStatusSelected: receivedStatusInterval});
                        }
                    }
                    else {
                        stringResult = GetTimestamp() + ": " + resultDecoded.toString().replace(',', ' : ');  + "\n";
                    }
                }
                else {
                    stringResult = GetTimestamp() + ": RAW : " + resultDecodedRaw  + "\n";
                }
                
                if (!this.logScreenDisabled) {
                    this.writeState(prevState => ({   // updater function to prevent race conditions (append new data)
                        NotifyData: [...prevState.NotifyData, stringResult + "\n"]
                    }));
                }
            });
        }
    }

    handleWriteText = text => {
        this.writeState({ writeText: text });
    }

    write() {
        let dev = this.state.device;
        //device.writeCharacteristicWithoutResponseForService(this.nordicUartService, this.uartRx, "heh")
        let encoded; // = EncodeBase64([1]);
        if (this.state.writeText) {   // if user write data send that
            //let textToSend = this.state.writeText.replace(/\s/g,'');    // remove spaces from it
            //encoded = EncodeBase64(textToSend);
            encoded = EncodeBase64(this.state.writeText);
        }
        console.log("Writing encoded data: " + encoded);
        this.manager.writeCharacteristicWithResponseForDevice(dev.id, this.uartService, this.uartRx, encoded)
            .then(() => {
                console.log("Write ok...");
            }, (error) => {
                console.log(error.message, error.reason);
                NotifyMessage("Error when sending data to the device!");
            });
    }

    read() {
        const dev = this.state.device;
        this.manager.readCharacteristicForDevice(dev.id, this.nordicUartService, this.readChar)
            .then((read_value) => {
                //console.log("read ok");
                const result = DecodeBase64(read_value.value);
                //console.log(result.length);
                NotifyMessage("Read: " + result[0]);
            }, (error) => {
                console.log(error.message);
            })
    }

    refreshData() {
        this.writeTrackerCommand(statusMessageCommand);             // Request status
        const that = this;
        setTimeout(() => {      // workaround for multiple commands TODO chain them together
            that.writeTrackerCommand("cmd_send_single_setting: 1");     // Request current lr_send_interval
        }, 100);
        setTimeout(() => {
            that.writeTrackerCommand("cmd_send_single_setting: 3");     // Request current status_send_interval
        }, 100);
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
        const devices = this.state.devices;
        if (devices.length > 0) { // show devices found
            return (
                <FlatList
                    data={devices}
                    renderItem={({ item }) => <ScanDeviceCard item_in={item} filter_name={this.bleFilterName} connectToDevice={this.connectToDevice} />}
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
                <View style={{backgroundColor: 'white', marginTop: 10, marginHorizontal: 3, padding: 5}}>
                    <Text style={styles.title}>No devices found yet</Text>
                    <Text style={styles.sectionTitle}>{filtersText}</Text>
                </View>
            );
        }
        else {  // No devices and no active filters
            return (
                <View style={{backgroundColor: 'white', marginTop: 10, marginHorizontal: 3, padding: 5}}>
                    <Text style={styles.title}>No devices found yet</Text>
                    <Text style={styles.sectionTitle}>No filters active</Text>
                </View>
            );
        }
    }

    onScanResultRefresh() {   // pull down on BLE devices list gesture handler
        this.writeState({ devices: [] });
        this.writeState({ numOfDevices: 0, refreshing: false });
        if (!this.state.scanRunning) {
            this.startScan();
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

        // prepare lookup table from settings.json for decoding data received from tracker
        //this.settingsLookupTable = GenerateSettingsLookupTable();

        this.oldJson = data;
        console.log("JSON filters parsed OK");
    }

    parseCmdCommands() {
        console.log("parseCmdCommands");
        let data = this.state.jsonParsed;
        // check if device contains commands and parse it
        if (data.commands !== undefined) {
            console.log("JSON data: found " + data.commands.length + " commands.");
            this.parseDeviceCommands(data.commands);
        }
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
        this.stopScan();     // stop scan if running
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

    // parse tracker commands specified in default_config.json with settings.json -> generate uart_command (raw command to send)
    parseDeviceCommands(commands) {
        var return_cmds = [];
        for (var command of commands) {
            if (command.uart_command === null) {        // if command in raw form (uint8s) is not given
                let current_command = command.device_command;
                if (current_command === "cmd_set_location_and_time:") {   // add additional values to command if it requires
                    console.log("found cmd_set_location_and_time cmd, append gps position and time from this device");
                    let position = this.state.latestPosition;
                    let datetime = this.getUnixTimeFromPhone();
                    current_command = current_command.concat(" " + position[0] + " " + position[1] + " " + datetime);
                    //console.log(current_command);
                }
                let new_device_command = EncodeTrackerSettings(current_command);
                if (new_device_command !== null) {
                    var new_command = command;
                    new_command.uart_command = new_device_command;
                    return_cmds.push(new_command);
                }
                else {      // if command does not exist in settings.json
                    console.log("Cannot parse command: " + command.device_command.toString());
                }
            }
            else {  // TODO wrap this in try catch
                let new_command = command;
                let cmdArray = command.uart_command.split(' ').map(x => parseInt(Number("0x" + x, 10)));    // convert string of hex numbers to array of ints
                let header = cmdArray.slice(0, 3);
                let values = cmdArray.slice(3);
                new_command.uart_command = packUintToBytes(header, values);
                return_cmds.push(new_command);
            }
        }
        this.writeState({ deviceCommands: return_cmds });
    }

    getUnixTimeFromPhone() {
        let date = new Date();
        let unixTimeStamp = Math.floor(date.getTime() / 1000);
        return unixTimeStamp;
    }

    displayUartButtons() {
        const views = [];
        for (var command of this.state.deviceCommands) {
            views.push(<UartButton key={command.name} title={command.name} uart_command={command.uart_command} writeCommand={this.writeUartCommand} />)
        }
        return views;
    }

    writeUartCommand = uart => {    // write encoded command
        console.log('button clicked, writing encoded command: ' + uart);
        this.writeState({ writeText: uart }, this.write);
    }

    writeTrackerCommand = cmd => {  // write command that is not yet encoded
        console.log('button clicked, encoding data and writing command: ' + cmd);
        let encoded_cmd = EncodeTrackerSettings(cmd);
        this.writeState({ writeText: encoded_cmd }, this.write);
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

    updatePickerLora(value) {
       this.writeState({pickerLoraSelected: value}, this.writeUartCommand(loraSendIntervalCommand + this.state.pickerLoraSelected));
    }

    updatePickerStatus(value) {
        this.writeState({pickerStatusSelected: value}, this.writeUartCommand(statusSendIntervalCommand + this.state.pickerStatusSelected));
    }

    render() {
        if (this.state.device === undefined || this.state.connectionInProgress) {       // TODO one of those is not triggered properly (when canceling connection)
            if (this.state.jsonEditActive) {  // edit json file screen
                return (
                    <View style={styles.container}>
                        <View style={{backgroundColor: 'white', margin: 2, padding: 5}}>
                            <Text style={styles.mainTitle}>
                                Json editor screen
                            </Text>
                            <View style={styles.multiLineViewMain}>
                                <View style={styles.multiLineView}>
                                    <Button
                                        color={darkBackColor}
                                        title="Save"
                                        onPress={() => this.closeJsonConfig(true)}
                                    />
                                </View>
                                <View style={styles.multiLineView}>
                                    <Button
                                        color={darkBackColor}
                                        title="Back"
                                        onPress={() => this.closeJsonConfig(false)}
                                    />
                                </View>
                            </View>
                            <View style={styles.multiLineViewMain}>
                                <View style={styles.multiLineView}>
                                    <Button
                                        color={darkBackColor}
                                        title="Import"
                                        onPress={() => this.importJsonConfig()}
                                    />
                                </View>
                                <View style={styles.multiLineView}>
                                    <Button
                                        color={darkBackColor}
                                        title="Export"
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
                    if (this.state.connectionInProgress) {
                        scanStatus = "Connecting...";
                        scanText = "Cancel";
                    }
                    else {
                        scanText = "Start scan";
                        scanStatus = "Idle";
                    }
                }

                return (
                    <View style={styles.container}>
                        <View style={{backgroundColor: 'white', margin: 2, padding: 5}}>
                            <Text style={styles.mainTitle}>
                                Smart Parks Sensors
                            </Text>
                            <View style={styles.multiLineViewMain}>
                                <View style={styles.multiLineView}>
                                <Button
                                    color={darkBackColor}
                                    title={scanText}
                                    onPress={() => this.startStopScan()}
                                />
                                </View>
                                <View style={styles.multiLineView}>
                                    <Button
                                        color={darkBackColor}
                                        title='Edit config'
                                        onPress={() => this.openJsonConfig()}
                                    />
                                </View>
                            </View>
                            <Separator />
                            <Text style={styles.title}>
                                Status: {scanStatus}
                            </Text>
                        </View>
                        <View style={styles.displayDevices}>
                            {this.displayResults()}
                        </View>
                    </View>
                );
            }
        }
        else {   // connect screen
            console.log("connect redraw");
            
            let displayName = this.state.device.name;
            let statusText = initialStatus;
            if (this.state.statusData) {
                console.log("Status data received");
                statusText = JSON.parse(this.state.statusData);
            }
            let device_type = hwTypeEnum[statusText.ver_hw_type];
            let error_text = "".concat(
                statusText.lr_err ? " LP1" : '',
                statusText.ble_err ? " ShortRange" : '',
                statusText.ublox_err ? " Ublox" : '',
                statusText.acc_err ? " Accel" : '',
                statusText.bat_err ? " Batt" : '',
                statusText.time_err ? " Time" : ''
            );
            if (error_text == "") {
                error_text = "No errors";
            }

            if (this.state.writeScreenActive) {  // write screen
                return (
                    <View style={styles.container}>
                        <View style={{backgroundColor: 'white', margin: 2, padding: 5, marginBottom: 8, }}>
                            <Text style={styles.mainTitle}>
                                Connected to {device_type} ({displayName})
                            </Text>
                            <View style={styles.multiLineViewMain}>
                                <View style={styles.multiLineView}>
                                    <Button
                                        color={darkBackColor}
                                        title='Disconnect'
                                        onPress={() => this.disconnect()}
                                    />
                                </View>
                                <View style={styles.multiLineView}>
                                    <Button
                                        color={darkBackColor}
                                        title='Refresh data'
                                        onPress={() => this.refreshData()}
                                    />
                                </View>
                            </View>
                        </View>
                        <KeyboardAwareScrollView>
                            <Card>
                                <CardItem cardBody style={{ justifyContent: "center" }}>
                                    <Icon name="message-text-outline" size={20} style={styles.normal_icon}/>
                                    <Text>Device status</Text>
                                </CardItem>
                                <CardItem cardBody style={styles.card_status}>
                                    <Icon name="chip" size={20} style={styles.normal_icon}/>
                                    <Text>v{statusText.ver_hw_major}.{statusText.ver_hw_minor}</Text>
                                    <Icon name="console" size={20} style={styles.normal_icon}/>
                                    <Text>v{statusText.ver_fw_major}.{statusText.ver_fw_minor}</Text>
                                    <Icon name="clock-fast" size={20} style={styles.normal_icon}/>
                                    <Text>{statusText.uptime} h</Text>
                                    <Icon name="restore-alert" size={20} style={styles.normal_icon}/>
                                    <Text>{statusText.reset}</Text>
                                    <Icon name="thermometer" size={20} style={{ marginTop: 3 }}/>
                                    <Text>{statusText.temp.toFixed(1)} °C</Text>
                                </CardItem>
                                <CardItem cardBody style={styles.card_status}>
                                    <Icon name="battery" size={20} style={styles.normal_icon}/>
                                    <Text>{statusText.bat} mV</Text>
                                    <Icon name="battery-charging" size={20} color={statusText.volt < chargingTreshold ? 'gray' : 'green'} style={styles.normal_icon} />
                                    <Icon name="satellite-variant" size={20} style={styles.normal_icon}/>
                                    <Text>{statusText.lr_sat}</Text>
                                    <Icon name="crosshairs-gps" size={20} style={styles.normal_icon}/>
                                    <Text>{statusText.lr_fix}</Text>
                                </CardItem>
                                <CardItem cardBody style={styles.card_status}>
                                    <Icon name="axis-arrow" size={20} style={styles.normal_icon}/>
                                    <Text>X: {statusText.acc_x.toFixed(1)}   Y: {statusText.acc_y.toFixed(1)}   Z: {statusText.acc_z.toFixed(1)} </Text>
                                </CardItem>
                                <CardItem cardBody style={{ marginHorizontal: 20, marginBottom: 5 }}>
                                    <Icon name="close-circle-outline" size={20} style={styles.normal_icon}/> 
                                    <Text>{error_text}</Text>
                                </CardItem>
                            </Card>
                            <Card>
                                <CardItem cardBody style={{ justifyContent: "center"}}>
                                    <Icon name="cloud-upload-outline" size={20} style={styles.normal_icon}/>
                                    <Text>Set sending intervals</Text>
                                </CardItem>
                                <CardItem cardBody style={styles.card_additional}>
                                    <Left>
                                        <Text>LR1 send</Text>
                                    </Left>
                                    <Picker
                                        mode="dropdown"
                                        iosIcon={<Icon name="arrow-down" />}
                                        style={{ width: undefined }}
                                        selectedValue={this.state.pickerLoraSelected}
                                        onValueChange={this.updatePickerLora.bind(this)}>
                                        <Picker.Item label="1 min" value={validPickerIntervalValues[0]} />
                                        <Picker.Item label="15 mins" value={validPickerIntervalValues[1]} />
                                        <Picker.Item label="1 hour" value={validPickerIntervalValues[2]} />
                                        <Picker.Item label="2 hours" value={validPickerIntervalValues[3]} />
                                        <Picker.Item label="4 hours" value={validPickerIntervalValues[4]} />
                                    </Picker>
                                </CardItem>
                                <CardItem cardBody style={styles.card_additional}>
                                    <Left>
                                        <Text>Status send</Text>
                                    </Left>
                                    <Picker
                                        mode="dropdown"
                                        iosIcon={<Icon name="arrow-down" />}
                                        style={{ width: undefined }}
                                        selectedValue={this.state.pickerStatusSelected}
                                        onValueChange={this.updatePickerStatus.bind(this)}>
                                        <Picker.Item label="1 min" value={validPickerIntervalValues[0]} />
                                        <Picker.Item label="15 mins" value={validPickerIntervalValues[1]} />
                                        <Picker.Item label="1 hour" value={validPickerIntervalValues[2]} />
                                        <Picker.Item label="2 hours" value={validPickerIntervalValues[3]} />
                                        <Picker.Item label="4 hours" value={validPickerIntervalValues[4]} />
                                    </Picker>
                                </CardItem>
                            </Card>
                            <Card>
                                <CardItem cardBody style={{ justifyContent: "center", marginBottom: 5 }}>
                                    <Icon name="tools" size={20} style={styles.normal_icon}/>
                                    <Text>Device commands</Text>
                                </CardItem>
                                {this.displayUartButtons()}
                            </Card>
                            <Card>
                                <CardItem cardBody style={styles.card_additional}>
                                    <Left>
                                        <Icon name="wrench-outline" size={20} style={styles.normal_icon}/>
                                        <Label>Custom command</Label>
                                    </Left>
                                    <Input 
                                        onChangeText={this.handleWriteText}
                                        style={{ margin: 10, backgroundColor: '#ebebeb' }}/>
                                    <Button
                                        color={darkBackColor}
                                        title='Send'
                                        onPress={() => this.write()}/>
                                </CardItem>
                            </Card>
                        </KeyboardAwareScrollView>
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
        backgroundColor: lightBackColor,
    },
    title: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 5,
    },
    mainTitle: {
        fontSize: 20,
        color: darkBackColor,
        fontWeight: 'bold',
        textAlign: 'center',
        marginVertical: 10,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.black,
        textAlign: 'center',
        marginBottom: 5,
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
        paddingBottom: 10,
        flex: 1,
    },
    normal_icon: {
        marginTop: 3,
        marginHorizontal: 5,
    },
    card_status: {
        marginHorizontal: 20,
    },
    card_additional: {
        marginHorizontal: 10,
    },
});

export default App;
