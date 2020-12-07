import React from 'react';
import { StyleSheet, View, Button } from 'react-native';
import { Container, Header, Content, Card, CardItem, Body, Text, Left, Right } from 'native-base';
import { darkBackColor } from '../Helpers';

const UartButton = (props) => {
    return (
        <View style={styles.button}>
            <Button
                color={darkBackColor}
                title={props.title}
                onPress={() => props.writeUartCommand(props.uart_command)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    button: {
        paddingBottom: 10,
        marginHorizontal: 10,
      },
})

export default UartButton;