import React from 'react';
import { View, Text, TouchableHighlight, StyleSheet} from 'react-native';

const ListDeviceItem = (props) => {
  return (
    <View style={styles.item}>
      <TouchableHighlight
          onPress={() => props.connectToDevice(props.item_in)}
          style={styles.rowFront}
          underlayColor={'#AAA'}
        >
        <Text style={styles.title}>
          {props.item_in.name}   {props.item_in.id}  RSSI: {props.item_in.rssi}
        </Text>
      </TouchableHighlight>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    backgroundColor: '#fcd703',
    padding: 5,
    fontSize: 5,
    marginVertical: 8,
    marginHorizontal: 16,
  },
  title: {
    textAlign: 'center',
    fontSize: 14,
    marginVertical: 10,
  },
})

export default ListDeviceItem;