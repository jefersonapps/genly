import React from 'react';
import { Text, View } from 'react-native';

const Pdf = (props: any) => (
  <View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }, props.style]}>
    <Text>Visualizador de PDF não disponível na web.</Text>
  </View>
);

export default Pdf;
