import { HttpAuthRepository } from '../../contexts/auth/infrastructure/HttpAuthRepository';
import { SecureSesionStorage } from '../../contexts/auth/infrastructure/SecureSesionStorage';
import { LoginUseCase } from '../../contexts/auth/application/LoginUseCase';
import { LogoutUseCase } from '../../contexts/auth/application/LogoutUseCase';
import { RestaurarSesionUseCase } from '../../contexts/auth/application/RestaurarSesionUseCase';
import { RefreshSessionUseCase } from '../../contexts/auth/application/RefreshSessionUseCase';
import { HttpTiendaRepository } from '../../contexts/tienda/infrastructure/HttpTiendaRepository';
import { ListarMisTiendasUseCase } from '../../contexts/tienda/application/ListarMisTiendasUseCase';
import { HttpProductoRepository } from '../../contexts/producto/infrastructure/HttpProductoRepository';
import { BuscarProductoUseCase } from '../../contexts/producto/application/BuscarProductoUseCase';
import { ObtenerProductoUseCase } from '../../contexts/producto/application/ObtenerProductoUseCase';
import { CrearProductoUseCase } from '../../contexts/producto/application/CrearProductoUseCase';
import { ActualizarProductoUseCase } from '../../contexts/producto/application/ActualizarProductoUseCase';
import { SubirImagenProductoUseCase } from '../../contexts/producto/application/SubirImagenProductoUseCase';
import { DesactivarProductoUseCase } from '../../contexts/producto/application/DesactivarProductoUseCase';
import { ActivarProductoUseCase } from '../../contexts/producto/application/ActivarProductoUseCase';
import { BuscarProductoPorCodigoUseCase } from '../../contexts/producto/application/BuscarProductoPorCodigoUseCase';
import { HttpCatalogoOpcionesRepository } from '../../contexts/producto/infrastructure/HttpCatalogoOpcionesRepository';
import { ListarCategoriasYMarcasUseCase } from '../../contexts/producto/application/ListarCategoriasYMarcasUseCase';
import { CrearCategoriaUseCase } from '../../contexts/producto/application/CrearCategoriaUseCase';
import { CrearMarcaUseCase } from '../../contexts/producto/application/CrearMarcaUseCase';
import { HttpProductoMaestroRepository } from '../../contexts/producto-maestro/infrastructure/HttpProductoMaestroRepository';
import { BuscarProductoMaestroUseCase } from '../../contexts/producto-maestro/application/BuscarProductoMaestroUseCase';
import { HttpVarianteRepository } from '../../contexts/producto/infrastructure/HttpVarianteRepository';
import { ListarVariantesUseCase } from '../../contexts/producto/application/ListarVariantesUseCase';
import { HttpVentaRepository } from '../../contexts/venta/infrastructure/HttpVentaRepository';
import { CrearVentaUseCase } from '../../contexts/venta/application/CrearVentaUseCase';
import { ListarVentasUseCase } from '../../contexts/venta/application/ListarVentasUseCase';
import { ObtenerVentaUseCase } from '../../contexts/venta/application/ObtenerVentaUseCase';
import { HttpCajaRepository } from '../../contexts/caja/infrastructure/HttpCajaRepository';
import { AbrirCajaUseCase } from '../../contexts/caja/application/AbrirCajaUseCase';
import { CerrarCajaUseCase } from '../../contexts/caja/application/CerrarCajaUseCase';
import { RegistrarMovimientoCajaUseCase } from '../../contexts/caja/application/RegistrarMovimientoCajaUseCase';
import { ObtenerCajaActualUseCase } from '../../contexts/caja/application/ObtenerCajaActualUseCase';
import { HttpAjusteInventarioRepository } from '../../contexts/ajuste-inventario/infrastructure/HttpAjusteInventarioRepository';
import { RegistrarAjusteUseCase } from '../../contexts/ajuste-inventario/application/RegistrarAjusteUseCase';
import { ListarMovimientosUseCase } from '../../contexts/ajuste-inventario/application/ListarMovimientosUseCase';
import { HttpUbicacionRepository } from '../../contexts/ubicacion/infrastructure/HttpUbicacionRepository';
import { ListarUbicacionesUseCase } from '../../contexts/ubicacion/application/ListarUbicacionesUseCase';
import { HttpStockRepository } from '../../contexts/stock/infrastructure/HttpStockRepository';
import { ListarStockPorUbicacionUseCase } from '../../contexts/stock/application/ListarStockPorUbicacionUseCase';
import { ListarStockPorProductoUseCase } from '../../contexts/stock/application/ListarStockPorProductoUseCase';
import { HttpClienteRepository } from '../../contexts/cliente/infrastructure/HttpClienteRepository';
import { BuscarClientePorRutUseCase } from '../../contexts/cliente/application/BuscarClientePorRutUseCase';
import { catalogoLocal } from '../catalogo/CatalogoSyncManager';

const authRepository = new HttpAuthRepository();
const sesionStorage = new SecureSesionStorage();
const negocioRepository = new HttpTiendaRepository();
const productoRepository = new HttpProductoRepository();
const varianteRepository = new HttpVarianteRepository();
const ventaRepository = new HttpVentaRepository();
const cajaRepository = new HttpCajaRepository();
const ajusteRepository = new HttpAjusteInventarioRepository();
const ubicacionRepository = new HttpUbicacionRepository();
const stockRepository = new HttpStockRepository();
const clienteRepository = new HttpClienteRepository();
const productoMaestroRepository = new HttpProductoMaestroRepository();
const catalogoOpcionesRepository = new HttpCatalogoOpcionesRepository();

export const container = {
  login: new LoginUseCase(authRepository, sesionStorage),
  logout: new LogoutUseCase(sesionStorage),
  restaurarSesion: new RestaurarSesionUseCase(sesionStorage),
  refreshSession: new RefreshSessionUseCase(authRepository),
  listarMisNegocios: new ListarMisTiendasUseCase(negocioRepository),
  buscarProducto: new BuscarProductoUseCase(productoRepository),
  obtenerProducto: new ObtenerProductoUseCase(productoRepository),
  crearProducto: new CrearProductoUseCase(productoRepository),
  actualizarProducto: new ActualizarProductoUseCase(productoRepository),
  subirImagenProducto: new SubirImagenProductoUseCase(productoRepository),
  desactivarProducto: new DesactivarProductoUseCase(productoRepository),
  activarProducto: new ActivarProductoUseCase(productoRepository),
  buscarProductoPorCodigo: new BuscarProductoPorCodigoUseCase(productoRepository),
  buscarProductoMaestro: new BuscarProductoMaestroUseCase(productoMaestroRepository),
  listarCategoriasYMarcas: new ListarCategoriasYMarcasUseCase(catalogoOpcionesRepository),
  crearCategoria: new CrearCategoriaUseCase(catalogoOpcionesRepository),
  crearMarca: new CrearMarcaUseCase(catalogoOpcionesRepository),
  listarVariantes: new ListarVariantesUseCase(varianteRepository),
  crearVenta: new CrearVentaUseCase(ventaRepository),
  listarVentas: new ListarVentasUseCase(ventaRepository),
  obtenerVenta: new ObtenerVentaUseCase(ventaRepository),
  obtenerCajaActual: new ObtenerCajaActualUseCase(cajaRepository),
  abrirCaja: new AbrirCajaUseCase(cajaRepository),
  cerrarCaja: new CerrarCajaUseCase(cajaRepository),
  registrarMovimientoCaja: new RegistrarMovimientoCajaUseCase(cajaRepository),
  registrarAjusteStock: new RegistrarAjusteUseCase(ajusteRepository),
  listarMovimientosInventario: new ListarMovimientosUseCase(ajusteRepository),
  listarUbicaciones: new ListarUbicacionesUseCase(ubicacionRepository),
  listarStockPorUbicacion: new ListarStockPorUbicacionUseCase(stockRepository),
  listarStockPorProducto: new ListarStockPorProductoUseCase(stockRepository),
  buscarClientePorRut: new BuscarClientePorRutUseCase(clienteRepository),
  catalogoLocalRepo: catalogoLocal.repo,
  syncCatalogo: catalogoLocal.syncUseCase,
};
