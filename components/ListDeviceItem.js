import React from 'react';
import { DecodeBase64, ParseTrackerAdvData, darkBackColor, lightBackColor, DecodeStatusMessage } from '../Helpers';
import { View, Text, TouchableHighlight, StyleSheet } from 'react-native';

const ListDeviceItem = (props) => {
    let text_default, text_line1, text_line2, text_line3, text_line4, text_raw;
    text_default = (    // print default info (name, mac, rssi)
        <Text key="text_default" style={styles.title}>
            {props.item_in.name}  {props.item_in.id}   rssi: {props.item_in.rssi} dBm
        </Text>
    );

    if (props.item_in.manufacturerData) {
        let decoded_raw_data = DecodeBase64(props.item_in.manufacturerData);
        //console.log(decoded_raw_data);
        let raw_data = decoded_raw_data.toJSON();
        if (props.item_in.name !== null && props.item_in.name.includes(props.filter_name)) {
            
            text_raw = (    // print raw manufacturer data in any case
                <Text key="text_raw" style={styles.subtitle}>
                    Raw data: {raw_data.data.toString()}
                </Text>
            );
            
            if (props.item_in.name.includes("Irnas")) {
                let array_raw_data = new Uint8Array(decoded_raw_data);
                let adv_data = DecodeStatusMessage(array_raw_data.slice(2));
                text_line1 = (
                    <Text key="text_line1" style={styles.subtitle}>    
                        Uptime: {adv_data.uptime} h Reset reason: {adv_data.reset}  Temp: {adv_data.temp.toFixed(2)} °C
                    </Text>
                );
                text_line2 = (
                    <Text key="text_line2" style={styles.subtitle}>
                        Battery: {adv_data.bat} mV  Charging voltage: {adv_data.volt} mV
                    </Text>
                );
                let error_text = (
                    adv_data.lr_err ? " LR" : '',
                    adv_data.ble_err ? " BLE" : '',
                    adv_data.ublox_err ? " Ublox" : '',
                    adv_data.acc_err ? " Accel" : '',
                    adv_data.bat_err ? " batt" : '',
                    adv_data.time_err ? " time" : ''
                );  // TODO display no errors
                text_line3 = (
                    <Text key="text_line3" style={styles.subtitle}>
                        Errors:
                        {error_text}
                    </Text>      
                );
                text_line4 = (
                    <Text key="text_line4" style={styles.subtitle}>
                        Acc data: x: {adv_data.acc_x.toFixed(3)} y: {adv_data.acc_y.toFixed(3)} z: {adv_data.acc_z.toFixed(3)}
                    </Text>
                );
            }
        }
    }

    let texts = [text_default, text_line1, text_line2, text_line3, text_line4, text_raw];
    let item_view = (
        <View>
            { texts }
        </View>
    );
        
    return (
        <View style={styles.item}>
            <TouchableHighlight
                onPress={() => props.connectToDevice(props.item_in)}
                style={styles.rowFront}
                underlayColor={'#AAA'}>
                {item_view}
            </TouchableHighlight>
        </View>
    );
}

const styles = StyleSheet.create({
    item: {
        backgroundColor: '#808080',
        paddingVertical: 5,
        paddingHorizontal: 5,
        fontSize: 5,
        marginVertical: 5,
        marginHorizontal: 3,
    },
    title: {
        textAlign: 'center',
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
        marginVertical: 3,
    },
    subtitle: {
        textAlign: 'center',
        color: 'white',
        fontSize: 13,
    }
})

export default ListDeviceItem;