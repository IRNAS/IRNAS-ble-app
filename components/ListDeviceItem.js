import React from 'react';
import { DecodeBase64, ParseTrackerAdvData } from '../Helpers';
import { View, Text, TouchableHighlight, StyleSheet } from 'react-native';

const ListDeviceItem = (props) => {
    let text_default, text_line1, text_line2, text_line3, text_raw;
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
            
            if (props.item_in.name.includes("Irnas") || props.item_in.name.includes("TestDomey")) {
                let tracker_data = ParseTrackerAdvData(decoded_raw_data);  // TODO
                text_line1 = (
                    <Text key="text_line1" style={styles.subtitle}>    
                        System status: OK  Battery: 2913 mV  
                    </Text>
                );
                text_line2 = (
                    <Text key="text_line2" style={styles.subtitle}>
                        Acc: x: 0.-191425; y: 0.535992; z: -9.-743574
                    </Text>
                );
                text_line3 = (
                    <Text key="text_line3" style={styles.subtitle}>
                        GPS: 46.555583, 15.632279  time: 2017-2-12 0:0:8
                    </Text>
                );
            }
        }
    }

    let texts = [text_default, text_line1, text_line2, text_line3, text_raw];
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