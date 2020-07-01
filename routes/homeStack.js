import { createStackNavigator } from 'react-navigation-stack';
import { createAppContainer } from 'react-navigation';

const screens = {
    Scan: {
        screen: Scan
    },
    Connect: {
        screen: Connect
    },
    EditJson: {
        screen: EditJson
    }
}

const HomeStack = createStackNavigator(screens);

export default createAppContainer(HomeStack);

// TODO finish this