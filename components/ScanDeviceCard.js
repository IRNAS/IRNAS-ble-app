import React, { Component } from 'react';
import { View, TouchableHighlight, StyleSheet } from 'react-native';
import { Container, Header, Content, Card, CardItem, Body, Text, Left, Right } from 'native-base';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { DecodeBase64, ParseTrackerAdvData, IrnasGreen, lightGreen, DecodeStatusMessage, chargingTreshold } from '../Helpers';

const ScanDeviceCard = (props) => {
    let basic_data = (
        <CardItem button bordered>
            <Icon name="bluetooth" size={40} />
            <Body>
                <Text style={styles.title}> {props.item_in.name}</Text>
                <Text style={styles.subtitle}> {props.item_in.id} </Text>
            </Body>
            <Right>
                <Text><Icon name="signal-cellular-3" size={20} /> {props.item_in.rssi} dBm </Text>
                <Text style={styles.small_text}>PRESS TO CONNECT</Text>
            </Right>
        </CardItem>
    );

    if (props.item_in.manufacturerData) {
        let additional_data_status, additional_data_accel, additional_data_error;
        let decoded_raw_data = DecodeBase64(props.item_in.manufacturerData);
        //console.log(decoded_raw_data);
        let raw_data = decoded_raw_data.toJSON();
        if (props.item_in.name !== null && props.item_in.name.includes(props.filter_name)) {
            
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
                <CardItem cardBody>
                    <Icon name="battery" size={20} style={styles.normal_icon}/>
                    <Body><Text>{adv_data.bat} mV</Text></Body>
                    <Icon name="battery-charging" size={20} color={adv_data.volt < chargingTreshold ? 'gray' : 'green'} />
                    <Icon name="thermometer" size={20} style={styles.normal_icon}/>
                    <Body><Text>{adv_data.temp.toFixed(1)} °C</Text></Body>
                </CardItem>
            );
            additional_data_accel = (
                <CardItem cardBody>
                    <Icon name="axis-arrow" size={20} style={styles.normal_icon}/>
                    <Body>
                        <Text>X: {adv_data.acc_x.toFixed(1)}   Y: {adv_data.acc_y.toFixed(1)}   Z: {adv_data.acc_z.toFixed(1)} </Text>
                    </Body>
                </CardItem>
            );
            if (array_raw_data.slice(2)[1] === 0){
                additional_data_error = (
                    <CardItem cardBody>
                        <Icon name="close-circle-outline" size={20} style={styles.normal_icon}/> 
                        <Body>
                            <Text>No errors</Text>
                        </Body>
                    </CardItem>
                );
            }
            else {
                let error_text = (
                    adv_data.lr_err ? " LR" : '',
                    adv_data.ble_err ? " BLE" : '',
                    adv_data.ublox_err ? " Ublox" : '',
                    adv_data.acc_err ? " accel" : '',
                    adv_data.bat_err ? " batt" : '',
                    adv_data.time_err ? " time" : ''
                );
                additional_data_error = (
                    <CardItem cardBody>
                        <Icon name="close-circle-outline" size={20} style={styles.normal_icon}/> <Text>{error_text}</Text>
                    </CardItem>
                );
            }
        }
        return (
            <Container>
                <Content>
                    <Card>
                        {basic_data}
                        {additional_data_status}
                        {additional_data_accel}
                        {additional_data_error}
                    </Card>
                </Content>
            </Container>
        );
    }
    else {
        return (
            <Container>
                <Content>
                    <Card>
                        {basic_data}
                    </Card>
                </Content>
            </Container>
        );
    }
}

const styles = StyleSheet.create({
    normal_icon: {
        marginHorizontal: 5,
    },
    title: {
        fontSize: 20,
    },
    subtitle: {
        fontSize: 16,
    },
    small_text: {
        marginTop: 2,
        textAlign: 'center',
        fontSize: 10,
    }
})

export default ScanDeviceCard;