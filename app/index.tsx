import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useSesionStore } from '../src/runtime/stores/SesionStore';
import { colors } from '../src/runtime/theme/tokens';

export default function Index() {
  const { sesion, negocio, cargando } = useSesionStore();

  if (cargando) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!sesion) return <Redirect href="/login" />;
  if (!negocio) return <Redirect href="/seleccionar-negocio" />;
  return <Redirect href="/(tabs)/pos" />;
}
