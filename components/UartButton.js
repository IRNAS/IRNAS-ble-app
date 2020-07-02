import React from 'react';
import { StyleSheet, View, Button } from 'react-native';

// TODO solve each child should have unique key prop

const UartButton = (props) => {
    return (
        <View style={styles.button_1}>
            <Button
                title={props.title}
                onPress={() => props.writeUartCommand(props.uart_command)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    button_1: {
        marginHorizontal: 10,
        paddingBottom: 10,
        alignContent: 'center',
      },
})

export default UartButton;