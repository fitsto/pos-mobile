/**
 * Wizard de creación de producto.
 *
 *   0. Inicio — ofrecer escanear código de barras o ingreso manual.
 *      • Si escanea y el código ya existe → navegar al detalle (evita duplicar).
 *      • Si existe pero está inactivo → ofrecer reactivarlo.
 *      • Si no existe → precargar `codigoBarras` y saltar al paso 1.
 *   1. Básicos — nombre + precio de costo + precio de venta. El usuario ve
 *      en vivo el desglose de IVA y la ganancia estimada para no quedar
 *      vendiendo a pérdida.
 *   2. Detalles — SKU, código de barras, descripción (todo opcional).
 *   3. Variantes — toggle "este producto tiene variantes" y CTA crear.
 *
 * La foto se sube desde el detalle una vez creado.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { ScannerModal } from '../../src/runtime/components/ScannerModal';
import {
    Button,
    Card,
    ListItem,
    Screen,
    Sheet,
    Text,
    TextField,
} from '../../src/runtime/components/ui';
import type { Categoria, Marca } from '../../src/contexts/producto/domain/Categoria';
import { Image } from 'expo-image';
import { container } from '../../src/runtime/di/container';
import { trySyncCatalogo } from '../../src/runtime/catalogo/CatalogoSyncManager';
import { useSesionStore } from '../../src/runtime/stores/SesionStore';
import { useTheme } from '../../src/runtime/theme/ThemeProvider';
import { formatCLP } from '../../src/runtime/utils/formato';

type Paso = 0 | 1 | 2 | 3;

const LABELS: Record<Paso, string> = {
    0: 'Inicio',
    1: 'Básicos',
    2: 'Detalles',
    3: 'Variantes',
};

export default function NuevoProductoScreen() {
    const t = useTheme();
    const router = useRouter();
    const sesion = useSesionStore((s) => s.sesion);
    const negocio = useSesionStore((s) => s.negocio);

    const [paso, setPaso] = useState<Paso>(0);
    const [scannerVisible, setScannerVisible] = useState(false);
    const [buscandoCodigo, setBuscandoCodigo] = useState(false);

    // Paso 1
    const [nombre, setNombre] = useState('');
    const [costo, setCosto] = useState('');
    const [precio, setPrecio] = useState('');
    const [stockInicial, setStockInicial] = useState('');
    // Ubicación donde se registra el stock inicial. Por defecto la principal
    // del negocio (o la única si sólo hay una). El operador no la elige
    // explícitamente para no agregar un paso más; si tiene varias y necesita
    // distribuir, lo hace después desde el detalle del producto.
    const [ubicacionId, setUbicacionId] = useState<string | null>(null);
    // Paso 2
    const [sku, setSku] = useState('');
    const [codigoBarras, setCodigoBarras] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [categoriaId, setCategoriaId] = useState<string | null>(null);
    const [marcaId, setMarcaId] = useState<string | null>(null);
    const [opcionesCategorias, setOpcionesCategorias] = useState<Categoria[]>([]);
    const [opcionesMarcas, setOpcionesMarcas] = useState<Marca[]>([]);
    // Picker abierto: 'categoria' | 'marca' | null. Una sola variable mantiene
    // la mutua exclusión sin tener que sincronizar dos booleanos.
    const [pickerAbierto, setPickerAbierto] = useState<'categoria' | 'marca' | null>(null);
    // Mini-form inline para crear cat/marca dentro del mismo sheet, sin
    // sacar al usuario del flujo. Si `creandoOpcionTipo` está seteado, el
    // sheet del tipo correspondiente muestra un input en lugar de la lista.
    const [creandoOpcionTipo, setCreandoOpcionTipo] = useState<'categoria' | 'marca' | null>(null);
    const [nuevaOpcionNombre, setNuevaOpcionNombre] = useState('');
    const [guardandoOpcion, setGuardandoOpcion] = useState(false);
    const [errorOpcion, setErrorOpcion] = useState<string | null>(null);
    // Paso 3
    const [usaVariantes, setUsaVariantes] = useState(false);

    // Precarga desde catálogo maestro (OFF u otro). Sólo informativo; se
    // muestra en paso 1 para que el usuario sepa de dónde salieron los datos.
    const [maestroImagenUrl, setMaestroImagenUrl] = useState<string | null>(null);
    const [maestroFuente, setMaestroFuente] = useState<string | null>(null);

    const [error, setError] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);

    // Auto-resolver ubicación principal al montar para que stock inicial
    // tenga dónde anclarse sin pedirle al operador que la elija.
    useEffect(() => {
        if (!sesion || !negocio || ubicacionId) return;
        let cancelado = false;
        container.listarUbicaciones
            .execute({ negocioId: negocio.id, token: sesion.token })
            .then((res) => {
                if (cancelado || res.length === 0) return;
                const principal = res.find((u) => u.esPrincipal) ?? res[0];
                setUbicacionId(principal.id);
            })
            .catch(() => {
                // No es fatal: si falla, igual se puede crear el producto;
                // el stock inicial simplemente no se registrará.
            });
        return () => {
            cancelado = true;
        };
    }, [sesion, negocio, ubicacionId]);

    // Categorías y marcas se cargan una vez al montar; se cachean en estado
    // local del wizard porque no se editan desde acá.
    useEffect(() => {
        if (!sesion || !negocio) return;
        let cancelado = false;
        container.listarCategoriasYMarcas
            .execute({ negocioId: negocio.id, token: sesion.token })
            .then(({ categorias, marcas }) => {
                if (cancelado) return;
                setOpcionesCategorias(categorias);
                setOpcionesMarcas(marcas);
            })
            .catch(() => {
                // Silencioso: si falla son lookups opcionales; el producto se
                // puede crear igual sin categoría/marca.
            });
        return () => {
            cancelado = true;
        };
    }, [sesion, negocio]);

    const precioNum = Number(precio);
    const costoNum = Number(costo);
    const precioValido = precio.trim().length > 0 && precioNum > 0;
    const costoValido = costo.trim().length > 0 && costoNum > 0;
    const puedeAvanzar =
        paso === 1
            ? nombre.trim().length >= 2 && precioValido && costoValido
            : true;

    // Desglose económico en vivo. `costo` se ingresa neto (sin IVA, lo que
    // factura el proveedor). `precio` se ingresa final (con IVA, lo que
    // paga el cliente). El IVA cobrado se calcula sobre el precio de venta
    // y la ganancia se computa neto vs neto para reflejar lo que de verdad
    // queda después de pagar IVA al SII.
    const iva = negocio?.impuestoVentaPorcentaje ?? 19;
    const precioNeto = precioValido ? Math.round(precioNum / (1 + iva / 100)) : 0;
    const ivaCobrado = precioValido ? precioNum - precioNeto : 0;
    const gananciaNeta = precioValido && costoValido ? precioNeto - costoNum : 0;
    const margenPct =
        precioValido && costoValido && precioNeto > 0
            ? Math.round((gananciaNeta / precioNeto) * 100)
            : 0;
    const enPerdida = precioValido && costoValido && gananciaNeta < 0;

    const atras = () => {
        setError(null);
        if (paso === 0) router.back();
        else setPaso((paso - 1) as Paso);
    };

    const siguiente = () => {
        setError(null);
        if (paso < 3) setPaso((paso + 1) as Paso);
    };

    const reactivarProducto = async (productoId: string) => {
        if (!sesion || !negocio) return;
        try {
            await container.activarProducto.execute({
                negocioId: negocio.id,
                productoId,
                token: sesion.token,
            });
            router.replace(`/producto/${productoId}`);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo reactivar');
        }
    };

    const onScan = async (codigo: string) => {
        setScannerVisible(false);
        if (!sesion || !negocio) return;
        setError(null);
        setBuscandoCodigo(true);
        try {
            const existente = await container.buscarProductoPorCodigo.execute({
                negocioId: negocio.id,
                codigoBarras: codigo,
                token: sesion.token,
                incluirInactivos: true,
            });
            if (existente) {
                if (existente.activo) {
                    Alert.alert(
                        'Ya existe este producto',
                        `"${existente.nombre}" ya está en tu catálogo. ¿Abrir su detalle?`,
                        [
                            { text: 'Cancelar', style: 'cancel' },
                            {
                                text: 'Abrir',
                                onPress: () => router.replace(`/producto/${existente.id}`),
                            },
                        ],
                    );
                } else {
                    Alert.alert(
                        'Producto desactivado',
                        `"${existente.nombre}" ya existe pero está inactivo. ¿Reactivarlo en lugar de crear uno nuevo?`,
                        [
                            { text: 'Cancelar', style: 'cancel' },
                            {
                                text: 'Reactivar',
                                onPress: () => void reactivarProducto(existente.id),
                            },
                        ],
                    );
                }
            } else {
                // No existe en el catálogo del negocio → probamos catálogo
                // maestro (base global propia + Open Food Facts de fallback).
                const maestro = await container.buscarProductoMaestro
                    .execute({
                        negocioId: negocio.id,
                        codigoBarras: codigo,
                        token: sesion.token,
                    })
                    .catch(() => null);

                if (maestro) {
                    Alert.alert(
                        'Sugerencia encontrada',
                        `Este código corresponde a:\n\n"${maestro.nombre}"${maestro.marca ? ` · ${maestro.marca}` : ''}\n\n¿Usar estos datos para precargar el formulario?`,
                        [
                            {
                                text: 'No, ingresar manual',
                                style: 'cancel',
                                onPress: () => {
                                    setCodigoBarras(codigo);
                                    setPaso(1);
                                },
                            },
                            {
                                text: 'Sí, usar datos',
                                onPress: () => {
                                    setCodigoBarras(codigo);
                                    setNombre(maestro.nombre);
                                    if (maestro.descripcion) setDescripcion(maestro.descripcion);
                                    setMaestroImagenUrl(maestro.imagenUrl ?? null);
                                    setMaestroFuente(maestro.source);
                                    setPaso(1);
                                },
                            },
                        ],
                    );
                } else {
                    Alert.alert(
                        'Producto no registrado',
                        `El código ${codigo} no existe en tu catálogo ni en el catálogo global. Completa los datos para agregarlo como producto nuevo.`,
                        [
                            {
                                text: 'Continuar',
                                onPress: () => {
                                    setCodigoBarras(codigo);
                                    setPaso(1);
                                },
                            },
                        ],
                    );
                }
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error al buscar el código');
        } finally {
            setBuscandoCodigo(false);
        }
    };

    const ingresarManual = () => {
        setError(null);
        setPaso(1);
    };

    const resetFormOpcion = () => {
        setCreandoOpcionTipo(null);
        setNuevaOpcionNombre('');
        setErrorOpcion(null);
        setGuardandoOpcion(false);
    };

    const cerrarPicker = () => {
        setPickerAbierto(null);
        resetFormOpcion();
    };

    const crearOpcion = async () => {
        if (!sesion || !negocio || !creandoOpcionTipo) return;
        const nombreLimpio = nuevaOpcionNombre.trim();
        if (nombreLimpio.length === 0) {
            setErrorOpcion('Ingresa un nombre.');
            return;
        }
        setErrorOpcion(null);
        setGuardandoOpcion(true);
        try {
            if (creandoOpcionTipo === 'categoria') {
                const nueva = await container.crearCategoria.execute({
                    negocioId: negocio.id,
                    token: sesion.token,
                    nombre: nombreLimpio,
                });
                setOpcionesCategorias((prev) => [...prev, nueva]);
                setCategoriaId(nueva.id);
            } else {
                const nueva = await container.crearMarca.execute({
                    negocioId: negocio.id,
                    token: sesion.token,
                    nombre: nombreLimpio,
                });
                setOpcionesMarcas((prev) => [...prev, nueva]);
                setMarcaId(nueva.id);
            }
            cerrarPicker();
        } catch (e) {
            setErrorOpcion(e instanceof Error ? e.message : 'No se pudo crear.');
        } finally {
            setGuardandoOpcion(false);
        }
    };

    const crear = async () => {
        if (!sesion || !negocio) return;
        setError(null);
        setEnviando(true);
        try {
            const nuevo = await container.crearProducto.execute({
                negocioId: negocio.id,
                token: sesion.token,
                nombre: nombre.trim(),
                precioVentaFinalUnitario: Number(precio),
                costoNetoUnitario: costo.trim() ? Number(costo) : undefined,
                sku: sku.trim() || null,
                codigoBarras: codigoBarras.trim() || null,
                descripcion: descripcion.trim() || null,
                usaVariantes,
                imagenUrlExterna: maestroImagenUrl,
                stockInicial: stockInicial.trim() ? Number(stockInicial) : null,
                ubicacionId:
                    stockInicial.trim() && Number(stockInicial) > 0 && !usaVariantes
                        ? ubicacionId
                        : null,
                categoriaId,
                marcaId,
            });
            // Refrescamos el catálogo local (sqlite) para que el POS encuentre
            // de inmediato el producto recién creado al escanear o buscar.
            void trySyncCatalogo();
            router.replace(`/producto/${nuevo.id}`);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error al crear el producto');
        } finally {
            setEnviando(false);
        }
    };

    return (
        <Screen
            title="Nuevo producto"
            subtitle={paso === 0 ? LABELS[paso] : `Paso ${paso} de 3 · ${LABELS[paso]}`}
            onBack={atras}
            backLabel={paso === 0 ? 'Cancelar' : 'Atrás'}
            footer={
                paso === 0 ? undefined : (
                    <View style={{ flexDirection: 'row', gap: t.space['2'] }}>
                        {paso < 3 ? (
                            <Button
                                label="Siguiente"
                                onPress={siguiente}
                                disabled={!puedeAvanzar}
                                size="lg"
                                fullWidth
                            />
                        ) : (
                            <Button
                                label="Crear producto"
                                onPress={crear}
                                disabled={enviando}
                                loading={enviando}
                                size="lg"
                                fullWidth
                            />
                        )}
                    </View>
                )
            }
        >
            {paso !== 0 ? <Stepper paso={paso} /> : null}

            <ScrollView
                contentContainerStyle={{ gap: t.space['3'], paddingBottom: t.space['6'] }}
                keyboardShouldPersistTaps="handled"
            >
                {paso === 0 ? (
                    <>
                        <Text variant="bodyMd" tone="secondary">
                            Escanea el código de barras del producto para revisar si ya existe en tu catálogo, o ingresa los datos manualmente.
                        </Text>

                        <OpcionGrande
                            icono="barcode-outline"
                            titulo="Escanear código de barras"
                            descripcion="Busca en tu catálogo: si ya existe te lleva al detalle, si está inactivo te deja reactivarlo, y si es nuevo precarga el código."
                            destacada
                            onPress={() => setScannerVisible(true)}
                            loading={buscandoCodigo}
                        />

                        <OpcionGrande
                            icono="create-outline"
                            titulo="Ingresar manualmente"
                            descripcion="Sin código de barras o sin escáner. Completas todos los datos a mano."
                            onPress={ingresarManual}
                        />
                    </>
                ) : paso === 1 ? (
                    <>
                        <TextField
                            label="Nombre"
                            value={nombre}
                            onChangeText={setNombre}
                            placeholder="Ej: Polera lisa"
                            autoFocus
                        />
                        <TextField
                            label="Precio de costo (CLP)"
                            value={costo}
                            onChangeText={(v) => setCosto(v.replace(/[^\d]/g, ''))}
                            placeholder="0"
                            keyboardType="number-pad"
                            mono
                            helper="Sin IVA. Lo que pagas a tu proveedor por unidad."
                        />
                        <TextField
                            label="Precio de venta (CLP)"
                            value={precio}
                            onChangeText={(v) => setPrecio(v.replace(/[^\d]/g, ''))}
                            placeholder="0"
                            keyboardType="number-pad"
                            mono
                            helper="Con IVA. Lo que paga el cliente."
                        />
                        {precioValido ? (
                            <Card
                                variant="subtle"
                                padding={3}
                                style={
                                    enPerdida
                                        ? { borderColor: t.color.feedback.dangerFg, borderWidth: t.border.default }
                                        : undefined
                                }
                            >
                                <View style={{ gap: t.space['2'] }}>
                                    <FilaDesglose
                                        label={`Precio neto (sin IVA ${iva}%)`}
                                        valor={formatCLP(precioNeto)}
                                    />
                                    <FilaDesglose
                                        label={`IVA cobrado (${iva}%)`}
                                        valor={formatCLP(ivaCobrado)}
                                        tone="tertiary"
                                    />
                                    {costoValido ? (
                                        <>
                                            <View
                                                style={{
                                                    height: 1,
                                                    backgroundColor: t.color.border.subtle,
                                                    marginVertical: 2,
                                                }}
                                            />
                                            <FilaDesglose
                                                label="Ganancia neta por unidad"
                                                valor={formatCLP(gananciaNeta)}
                                                tone={enPerdida ? 'danger' : 'success'}
                                                emphasized
                                            />
                                            <FilaDesglose
                                                label="Margen sobre neto"
                                                valor={`${margenPct}%`}
                                                tone={enPerdida ? 'danger' : 'secondary'}
                                            />
                                            {enPerdida ? (
                                                <Text variant="bodySm" tone="danger" style={{ marginTop: 2 }}>
                                                    Estás vendiendo bajo el costo. Revisa el precio.
                                                </Text>
                                            ) : null}
                                        </>
                                    ) : (
                                        <Text variant="bodySm" tone="tertiary">
                                            Ingresa el precio de costo para ver tu ganancia.
                                        </Text>
                                    )}
                                </View>
                            </Card>
                        ) : (
                            <Text variant="bodySm" tone="tertiary">
                                Con nombre, costo y precio ya puedes empezar a vender. Todo lo demás es opcional.
                            </Text>
                        )}
                        <TextField
                            label="Stock inicial (opcional)"
                            value={stockInicial}
                            onChangeText={(v) => setStockInicial(v.replace(/[^\d]/g, ''))}
                            placeholder="0"
                            keyboardType="number-pad"
                            mono
                            helper="Cuántas unidades tienes ya disponibles. Puedes ajustarlo después."
                        />
                        {codigoBarras ? (
                            <Card variant="subtle" padding={3}>
                                <View style={{ flexDirection: 'row', gap: t.space['3'], alignItems: 'center' }}>
                                    {maestroImagenUrl ? (
                                        <Image
                                            source={{ uri: maestroImagenUrl }}
                                            style={{
                                                width: 56,
                                                height: 56,
                                                borderRadius: t.radius.md,
                                                backgroundColor: t.color.bg.sunken,
                                            }}
                                            contentFit="cover"
                                        />
                                    ) : null}
                                    <View style={{ flex: 1 }}>
                                        <Text variant="bodySm" tone="secondary">
                                            Código escaneado:{' '}
                                            <Text variant="bodySm" emphasized>
                                                {codigoBarras}
                                            </Text>
                                        </Text>
                                        {maestroFuente ? (
                                            <Text variant="bodySm" tone="tertiary" style={{ marginTop: 2 }}>
                                                Datos sugeridos desde{' '}
                                                {maestroFuente === 'openfoodfacts'
                                                    ? 'Open Food Facts'
                                                    : 'catálogo global'}
                                                . Puedes editarlos antes de guardar.
                                            </Text>
                                        ) : null}
                                    </View>
                                </View>
                            </Card>
                        ) : null}
                    </>
                ) : paso === 2 ? (
                    <>
                        <SelectorRef
                            label="Categoría (opcional)"
                            valor={
                                opcionesCategorias.find((c) => c.id === categoriaId)?.nombre ??
                                null
                            }
                            placeholder={
                                opcionesCategorias.length === 0
                                    ? 'Tocar para crear o dejar sin categoría'
                                    : 'Sin categoría'
                            }
                            onPress={() => setPickerAbierto('categoria')}
                            onClear={categoriaId ? () => setCategoriaId(null) : undefined}
                        />
                        <SelectorRef
                            label="Marca (opcional)"
                            valor={
                                opcionesMarcas.find((m) => m.id === marcaId)?.nombre ?? null
                            }
                            placeholder={
                                opcionesMarcas.length === 0
                                    ? 'Tocar para crear o dejar sin marca'
                                    : 'Sin marca'
                            }
                            onPress={() => setPickerAbierto('marca')}
                            onClear={marcaId ? () => setMarcaId(null) : undefined}
                        />
                        <TextField
                            label="SKU"
                            value={sku}
                            onChangeText={setSku}
                            placeholder="Opcional"
                            mono
                        />
                        <TextField
                            label="Código de barras"
                            value={codigoBarras}
                            onChangeText={setCodigoBarras}
                            placeholder="EAN / UPC"
                            mono
                            keyboardType="number-pad"
                        />
                        <TextField
                            label="Descripción (opcional)"
                            value={descripcion}
                            onChangeText={setDescripcion}
                            placeholder="Breve descripción del producto…"
                            multiline
                        />
                    </>
                ) : (
                    <>
                        <OpcionVariantes
                            activa={!usaVariantes}
                            titulo="Producto simple"
                            descripcion="Un único ítem con su propio stock. Ideal para la mayoría de productos."
                            onPress={() => setUsaVariantes(false)}
                        />
                        <OpcionVariantes
                            activa={usaVariantes}
                            titulo="Con variantes"
                            descripcion="Varios modelos o tallas con stock independiente. Ej: polera en rojo/azul/negro."
                            onPress={() => setUsaVariantes(true)}
                        />
                        {usaVariantes ? (
                            <Card variant="subtle" padding={3}>
                                <Text variant="bodySm" tone="secondary">
                                    Después de crearlo, entrarás al detalle para definir los modelos y
                                    tallas (ej: rojo · S, rojo · M, azul · S, etc.).
                                </Text>
                            </Card>
                        ) : null}
                    </>
                )}

                {error ? (
                    <Text variant="bodySm" tone="danger">
                        {error}
                    </Text>
                ) : null}
            </ScrollView>

            <ScannerModal
                visible={scannerVisible}
                onClose={() => setScannerVisible(false)}
                onScan={onScan}
            />

            <Sheet
                visible={pickerAbierto === 'categoria'}
                onClose={cerrarPicker}
                title="Elegir categoría"
            >
                {creandoOpcionTipo === 'categoria' ? (
                    <View style={{ gap: t.space['3'] }}>
                        <TextField
                            label="Nombre de la categoría"
                            value={nuevaOpcionNombre}
                            onChangeText={setNuevaOpcionNombre}
                            placeholder="Ej: Bebidas"
                            autoFocus
                        />
                        {errorOpcion ? (
                            <Text variant="bodySm" tone="danger">
                                {errorOpcion}
                            </Text>
                        ) : null}
                        <View style={{ flexDirection: 'row', gap: t.space['2'] }}>
                            <Button
                                label="Cancelar"
                                variant="secondary"
                                onPress={resetFormOpcion}
                                disabled={guardandoOpcion}
                                style={{ flex: 1 }}
                            />
                            <Button
                                label="Crear"
                                onPress={crearOpcion}
                                loading={guardandoOpcion}
                                disabled={guardandoOpcion}
                                style={{ flex: 1 }}
                            />
                        </View>
                    </View>
                ) : (
                    <ScrollView style={{ maxHeight: 360 }}>
                        <ListItem
                            title="+ Crear nueva categoría"
                            onPress={() => {
                                setCreandoOpcionTipo('categoria');
                                setNuevaOpcionNombre('');
                                setErrorOpcion(null);
                            }}
                            divider
                        />
                        <ListItem
                            title="Sin categoría"
                            onPress={() => {
                                setCategoriaId(null);
                                cerrarPicker();
                            }}
                            divider
                        />
                        {opcionesCategorias.map((c) => (
                            <ListItem
                                key={c.id}
                                title={c.nombre}
                                trailing={
                                    categoriaId === c.id ? (
                                        <Ionicons
                                            name="checkmark"
                                            size={20}
                                            color={t.color.accent.default}
                                        />
                                    ) : null
                                }
                                onPress={() => {
                                    setCategoriaId(c.id);
                                    cerrarPicker();
                                }}
                                divider
                            />
                        ))}
                    </ScrollView>
                )}
            </Sheet>

            <Sheet
                visible={pickerAbierto === 'marca'}
                onClose={cerrarPicker}
                title="Elegir marca"
            >
                {creandoOpcionTipo === 'marca' ? (
                    <View style={{ gap: t.space['3'] }}>
                        <TextField
                            label="Nombre de la marca"
                            value={nuevaOpcionNombre}
                            onChangeText={setNuevaOpcionNombre}
                            placeholder="Ej: Coca-Cola"
                            autoFocus
                        />
                        {errorOpcion ? (
                            <Text variant="bodySm" tone="danger">
                                {errorOpcion}
                            </Text>
                        ) : null}
                        <View style={{ flexDirection: 'row', gap: t.space['2'] }}>
                            <Button
                                label="Cancelar"
                                variant="secondary"
                                onPress={resetFormOpcion}
                                disabled={guardandoOpcion}
                                style={{ flex: 1 }}
                            />
                            <Button
                                label="Crear"
                                onPress={crearOpcion}
                                loading={guardandoOpcion}
                                disabled={guardandoOpcion}
                                style={{ flex: 1 }}
                            />
                        </View>
                    </View>
                ) : (
                    <ScrollView style={{ maxHeight: 360 }}>
                        <ListItem
                            title="+ Crear nueva marca"
                            onPress={() => {
                                setCreandoOpcionTipo('marca');
                                setNuevaOpcionNombre('');
                                setErrorOpcion(null);
                            }}
                            divider
                        />
                        <ListItem
                            title="Sin marca"
                            onPress={() => {
                                setMarcaId(null);
                                cerrarPicker();
                            }}
                            divider
                        />
                        {opcionesMarcas.map((m) => (
                            <ListItem
                                key={m.id}
                                title={m.nombre}
                                trailing={
                                    marcaId === m.id ? (
                                        <Ionicons
                                            name="checkmark"
                                            size={20}
                                            color={t.color.accent.default}
                                        />
                                    ) : null
                                }
                                onPress={() => {
                                    setMarcaId(m.id);
                                    cerrarPicker();
                                }}
                                divider
                            />
                        ))}
                    </ScrollView>
                )}
            </Sheet>
        </Screen>
    );
}

/**
 * Fila clickeable que muestra un valor de referencia (categoría, marca, etc.)
 * y abre un sheet al tocarse. No usa TextField porque no se edita texto: el
 * input es la selección desde una lista.
 */
function SelectorRef({
    label,
    valor,
    placeholder,
    disabled,
    onPress,
    onClear,
}: {
    label: string;
    valor: string | null;
    placeholder: string;
    disabled?: boolean;
    onPress: () => void;
    onClear?: () => void;
}) {
    const t = useTheme();
    return (
        <View style={{ gap: t.space['1'] }}>
            <Text variant="label" tone="secondary">
                {label}
            </Text>
            <Pressable
                onPress={onPress}
                disabled={disabled}
                style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: t.space['2'],
                    paddingHorizontal: t.space['3'],
                    paddingVertical: t.space['3'],
                    borderRadius: t.radius.md,
                    borderWidth: t.border.default,
                    borderColor: t.color.border.subtle,
                    backgroundColor: pressed ? t.color.bg.sunken : t.color.bg.canvas,
                    opacity: disabled ? 0.5 : 1,
                })}
            >
                <Text
                    variant="bodyMd"
                    tone={valor ? 'primary' : 'tertiary'}
                    style={{ flex: 1 }}
                >
                    {valor ?? placeholder}
                </Text>
                {onClear && valor ? (
                    <Pressable
                        onPress={onClear}
                        hitSlop={8}
                        accessibilityLabel={`Quitar ${label.toLowerCase()}`}
                    >
                        <Ionicons name="close-circle" size={18} color={t.color.fg.tertiary} />
                    </Pressable>
                ) : null}
                <Ionicons name="chevron-down" size={18} color={t.color.fg.tertiary} />
            </Pressable>
        </View>
    );
}

function FilaDesglose({
    label,
    valor,
    tone,
    emphasized,
}: {
    label: string;
    valor: string;
    tone?: 'primary' | 'secondary' | 'tertiary' | 'success' | 'danger';
    emphasized?: boolean;
}) {
    return (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="bodySm" tone={tone === 'success' || tone === 'danger' ? 'secondary' : (tone ?? 'secondary')}>
                {label}
            </Text>
            <Text variant="monoSm" tone={tone ?? 'primary'} emphasized={emphasized} tabular>
                {valor}
            </Text>
        </View>
    );
}

function Stepper({ paso }: { paso: Paso }) {
    const t = useTheme();
    const pasos: Paso[] = [1, 2, 3];
    return (
        <View style={{ flexDirection: 'row', gap: t.space['2'], marginBottom: t.space['4'] }}>
            {pasos.map((p) => (
                <View
                    key={p}
                    style={{
                        flex: 1,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor:
                            p <= paso ? t.color.accent.default : t.color.border.subtle,
                    }}
                />
            ))}
        </View>
    );
}

function OpcionGrande({
    icono,
    titulo,
    descripcion,
    onPress,
    destacada,
    loading,
}: {
    icono: keyof typeof Ionicons.glyphMap;
    titulo: string;
    descripcion: string;
    onPress: () => void;
    destacada?: boolean;
    loading?: boolean;
}) {
    const t = useTheme();
    return (
        <Pressable
            onPress={onPress}
            disabled={loading}
            style={({ pressed }) => ({
                borderRadius: t.radius.lg,
                borderWidth: t.border.default,
                borderColor: destacada ? t.color.accent.default : t.color.border.subtle,
                backgroundColor: destacada
                    ? pressed
                        ? t.color.accent.pressed
                        : t.color.accent.default
                    : pressed
                        ? t.color.bg.sunken
                        : t.color.bg.raised,
                padding: t.space['4'],
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.space['3'],
                opacity: loading ? 0.6 : 1,
            })}
        >
            <View
                style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: destacada
                        ? 'rgba(255,255,255,0.18)'
                        : t.color.bg.sunken,
                }}
            >
                {loading ? (
                    <ActivityIndicator color={destacada ? t.color.fg.onAccent : t.color.accent.default} />
                ) : (
                    <Ionicons
                        name={icono}
                        size={28}
                        color={destacada ? t.color.fg.onAccent : t.color.fg.primary}
                    />
                )}
            </View>
            <View style={{ flex: 1 }}>
                <Text
                    variant="headingSm"
                    style={destacada ? { color: t.color.fg.onAccent } : undefined}
                >
                    {titulo}
                </Text>
                <Text
                    variant="bodySm"
                    style={{
                        marginTop: 2,
                        color: destacada ? t.color.fg.onAccent : t.color.fg.secondary,
                        opacity: destacada ? 0.9 : 1,
                    }}
                >
                    {descripcion}
                </Text>
            </View>
            <Ionicons
                name="chevron-forward"
                size={20}
                color={destacada ? t.color.fg.onAccent : t.color.fg.tertiary}
            />
        </Pressable>
    );
}

function OpcionVariantes({
    activa,
    titulo,
    descripcion,
    onPress,
}: {
    activa: boolean;
    titulo: string;
    descripcion: string;
    onPress: () => void;
}) {
    const t = useTheme();
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => ({
                borderRadius: t.radius.lg,
                borderWidth: t.border.default,
                borderColor: activa ? t.color.accent.default : t.color.border.subtle,
                backgroundColor: activa
                    ? t.color.accent.soft
                    : pressed
                        ? t.color.bg.sunken
                        : t.color.bg.raised,
                padding: t.space['4'],
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: t.space['3'],
            })}
        >
            <Ionicons
                name={activa ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={activa ? t.color.accent.default : t.color.fg.tertiary}
                style={{ marginTop: 2 }}
            />
            <View style={{ flex: 1 }}>
                <Text variant="headingSm">{titulo}</Text>
                <Text variant="bodySm" tone="secondary" style={{ marginTop: 2 }}>
                    {descripcion}
                </Text>
            </View>
        </Pressable>
    );
}
