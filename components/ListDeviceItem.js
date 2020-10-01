import React from 'react';
import { DecodeBase64 } from '../Helpers';
import { View, Text, TouchableHighlight, StyleSheet } from 'react-native';

const ListDeviceItem = (props) => {
    let item_view = (
        <View>
            <Text style={styles.title}>
                {props.item_in.name}  {props.item_in.id}   rssi: {props.item_in.rssi} dBm
            </Text>
        </View>
        );
    
    if (props.item_in.manufacturerData) {
        let decoded_raw_data = DecodeBase64(props.item_in.manufacturerData);
        //console.log(decoded_raw_data);
        let raw_data = decoded_raw_data.toJSON();
        if (props.item_in.name !== null && props.item_in.name.includes(props.filter_name)) {
            if (props.item_in.name.includes("iz")) {    // TODO parse leakage, op mode and connection
                item_view = 
                <View>
                    <Text style={styles.title}>
                    {props.item_in.name}  {props.item_in.id}   rssi: {props.item_in.rssi} dBm
                    </Text>
                    <Text style={styles.subtitle}>
                        Leakage: {raw_data.data[2]} {raw_data.data[3]}    Surge: {raw_data.data[4]}    Battery: {raw_data.data[5]} mV
                    </Text>
                    <Text style={styles.subtitle}>
                        Op mode: {raw_data.data[6]}   Connection: {raw_data.data[7]}
                    </Text>
                    <Text style={styles.subtitle}>
                        Raw data: {raw_data.data.toString()}
                    </Text>
                </View>;
            }
            else if (props.item_in.name === "TestDomey") {  // TODO print raw data as hex
                item_view = 
                <View>
                    <Text style={styles.title}>
                        {props.item_in.name}  {props.item_in.id}   rssi: {props.item_in.rssi} dBm
                    </Text>
                    <Text style={styles.subtitle}>
                        Alarm state: {raw_data.data[2]}
                    </Text>
                    <Text style={styles.subtitle}>
                        Raw data: {raw_data.data.toString()}
                    </Text>
                </View>;
            }
            else {
                item_view = 
                <View>
                    <Text style={styles.title}>
                        {props.item_in.name}   {props.item_in.id}  RSSI: {props.item_in.rssi}
                    </Text>
                    <Text style={styles.subtitle}>
                        Raw data: {raw_data.data.toString()}
                    </Text>
                </View>;
            }
        }
    }
        
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

function parseManufacturerData() {  // TODO
    //if ()
}

const styles = StyleSheet.create({
    item: {
        backgroundColor: '#fcd703',
        paddingVertical: 8,
        fontSize: 5,
        marginVertical: 5,
        marginHorizontal: 3,
    },
    title: {
        textAlign: 'center',
        color: 'green',
        fontWeight: 'bold',
        fontSize: 15,
        marginVertical: 5,
    },
    subtitle: {
        textAlign: 'center',
        fontSize: 13,
    }
})

export default ListDeviceItem;