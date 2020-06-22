import React from 'react';
import { StyleSheet, View, Button } from 'react-native';

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
        marginHorizontal: 3,
        alignContent: 'center',
        paddingHorizontal: 3,
      },
})

export default UartButton;