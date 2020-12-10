import React, { Component } from 'react';
import { View, TouchableHighlight, StyleSheet } from 'react-native';
import { Container, Header, Content, Card, CardItem, Body, Text, Left, Right } from 'native-base';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { DecodeBase64, ParseTrackerAdvData, darkBackColor, lightBackColor, DecodeStatusMessage, chargingTreshold, hwTypeEnum } from '../Helpers';
import RhinoIcon from '../custom_icons/RhinoIcon';
import ElephantIcon from '../custom_icons/ElephantIcon';
import WisentIcon from '../custom_icons/WisentIcon';

const ScanDeviceCard = (props) => {
    let device_name = "N/A";
    if (props.item_in.name != null) {
        device_name = props.item_in.name;
    }
    
    if (props.item_in.manufacturerData && props.item_in.name != null && props.item_in.name.includes(props.filter_name)) {
        let additional_data_status, additional_data_accel, additional_data_error;
        let decoded_raw_data = DecodeBase64(props.item_in.manufacturerData);
        //console.log(decoded_raw_data);
        let raw_data = decoded_raw_data.toJSON();
        /* // TODO use some kind of debug flag (add switch in the settings)
        text_raw = (    // print raw manufacturer data in any case
            <Text key="text_raw" style={styles.subtitle}>
                Raw data: {raw_data.data.toString()}
            </Text>
        );
        */

        let array_raw_data = new Uint8Array(decoded_raw_data);
        let adv_data = DecodeStatusMessage(array_raw_data.slice(2));
        additional_data_status = (
            <CardItem cardBody style={styles.card_additional}>
                <Icon name="chip" size={20} style={styles.normal_icon}/>
                <Text>v{adv_data.ver_hw_major}.{adv_data.ver_hw_minor}</Text>
                <Icon name="console" size={20} style={styles.normal_icon}/>
                <Text>v{adv_data.ver_fw_major}.{adv_data.ver_fw_minor}</Text>
                <Icon name="battery" size={20} style={styles.normal_icon}/>
                <Text>{adv_data.bat} mV</Text>
                <Icon name="battery-charging" size={20} color={adv_data.volt < chargingTreshold ? 'gray' : 'green'} style={styles.normal_icon} />
            </CardItem>
        );
        additional_data_accel = (
            <CardItem cardBody style={styles.card_additional}>
                <Icon name="axis-arrow" size={20} style={styles.normal_icon}/>
                <Text>X: {adv_data.acc_x.toFixed(1)}   Y: {adv_data.acc_y.toFixed(1)}   Z: {adv_data.acc_z.toFixed(1)} </Text>
                <Icon name="thermometer" size={20} style={styles.normal_icon}/>
                <Text>{adv_data.temp.toFixed(1)} °C</Text>
            </CardItem>
        );
        if (array_raw_data.slice(2)[1] === 0) {
            additional_data_error = (
                <CardItem cardBody style={styles.card_additional}>
                    <Icon name="close-circle-outline" size={20} style={styles.normal_icon}/> 
                    <Text>No errors</Text>
                </CardItem>
            );
        }
        else {
            let error_text = "".concat(
                adv_data.err_lr ? " LP1" : '',
                adv_data.err_ble ? " ShortRange" : '',
                adv_data.err_ublox ? " Ublox" : '',
                adv_data.err_acc ? " Accel" : '',
                adv_data.err_bat ? " Batt" : '',
                adv_data.err_time ? " Time" : ''
            );
            additional_data_error = (
                <CardItem cardBody style={styles.card_additional}>
                    <Icon name="close-circle-outline" size={20} style={styles.normal_icon}/> 
                    <Text>{error_text}</Text>
                </CardItem>
            );
        }

        let icon_device_type = (<Icon name="bluetooth" size={40} />);
        switch(hwTypeEnum[adv_data.ver_hw_type]) {
            case "Rhino":
                icon_device_type = (<RhinoIcon size={45} />);
                break;
            case "Elephant":
                icon_device_type = (<ElephantIcon size={45} />);
                break;
            case "Wisent":
                icon_device_type = (<WisentIcon size={45} /> );
                break;
            default:
                icon_device_type = (<Icon name="google-downasaur" size={45} />);
        }
        
        let basic_data = (
            <CardItem bordered button onPress={() => props.connectToDevice(props.item_in)}>
                {icon_device_type}
                <Body style={{ marginStart: 5 }}>
                    <Text style={styles.title}> {device_name} </Text>
                    <Text style={styles.subtitle}> {props.item_in.id} </Text>
                </Body>
                <Right>
                    <Text><Icon name="signal-cellular-3" size={20} /> {props.item_in.rssi} dBm </Text>
                    <Text style={styles.small_text}>PRESS TO CONNECT</Text>
                </Right>
            </CardItem>
        );

        return (
            <Card style={styles.card}>
                {basic_data}
                {additional_data_status}
                {additional_data_accel}
                {additional_data_error}
            </Card>
        );
    }
    else {
        let basic_data = (
            <CardItem bordered button onPress={() => props.connectToDevice(props.item_in)}>
                <Icon name="bluetooth" size={40} />
                <Body>
                    <Text style={styles.title}> {device_name} </Text>
                    <Text style={styles.subtitle}> {props.item_in.id} </Text>
                </Body>
                <Right>
                    <Text><Icon name="signal-cellular-3" size={20} /> {props.item_in.rssi} dBm </Text>
                    <Text style={styles.small_text}>PRESS TO CONNECT</Text>
                </Right>
            </CardItem>
        );
        return (
            <Card>
                {basic_data}
            </Card>
        );
    }
}

const styles = StyleSheet.create({
    normal_icon: {
        marginTop: 3,
        marginHorizontal: 5,
    },
    card_additional: {
        marginHorizontal: 20,
    },
    card: {
        paddingBottom: 5,
    },
    title: {
        fontSize: 22,
        fontWeight: "bold",
        color: darkBackColor,
    },
    subtitle: {
        fontSize: 16,
    },
    small_text: {
        marginTop: 2,
        textAlign: 'center',
        fontSize: 10,
        fontWeight: "bold",
        color: lightBackColor,
    }
});

export default ScanDeviceCard;