import { DATOS_TIENDA, enlaceWhatsappTienda } from '@shared/utils/datos-tienda';

export interface LegalInfo {
  brand: string;
  siteUrl: string;
  address: string;
  whatsappUrl: string;
  whatsappLabel: string;
  instagramUrl: string;
  /** Versión vigente de la Política de Privacidad y de los Términos, como fecha AAAA-MM-DD. Se guarda junto con la aceptación al registrarse */
  version: string;
  /** Esa misma fecha, escrita para mostrarla ("21 de octubre de 2026") */
  lastUpdate: string;
  /** Razón social o nombre completo del titular del comercio. Vacío = no se muestra */
  legalName: string;
  /** CUIT del titular del comercio. Vacío = no se muestra */
  cuit: string;
  /** Email de contacto para consultas y ejercicio de derechos. Vacío = no se muestra */
  contactEmail: string;
}

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/**
 * "2026-10-21" -> "21 de octubre de 2026". No usa Intl a propósito: estas páginas se
 * pre-renderizan en el build y el resultado tiene que ser idéntico en el servidor y en el navegador.
 */
function formatLongDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return `${day} de ${MONTHS[month - 1]} de ${year}`;
}

/** Cambiar SOLO cuando cambia el texto de los Términos o de la Política (ver LEGAL_INFO). */
const LEGAL_VERSION = '2026-10-22';

/**
 * Datos que comparten la Política de Privacidad y los Términos y Condiciones.
 *
 * Los campos opcionales (legalName, cuit, contactEmail) se muestran solo si se completan.
 * Conviene completarlos: la normativa de comercio electrónico pide identificar al proveedor.
 * Al cambiar cualquier texto legal hay que actualizar también LEGAL_VERSION: queda registrada
 * junto con la aceptación de cada persona que se registra.
 */
export const LEGAL_INFO: LegalInfo = {
  brand: 'Laelsi',
  siteUrl: 'https://laelsi.com.ar',
  address: '9 de Julio 2325, Rosario (2000), Santa Fe, Argentina',
  whatsappUrl: enlaceWhatsappTienda(),
  whatsappLabel: DATOS_TIENDA.whatsapp,
  instagramUrl: 'https://www.instagram.com/laelsi.ros/',
  version: LEGAL_VERSION,
  lastUpdate: formatLongDate(LEGAL_VERSION),
  legalName: 'Cesar Orlando Ramírez',
  cuit: '20-18436882-0',
  contactEmail: 'laelsiadm@gmail.com',
};
