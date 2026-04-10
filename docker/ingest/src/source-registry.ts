export type SourceDefinition = {
  key: string;
  name: string;
  url: string;
  jurisdiction: string;
  interfaceType: string;
  cadence: string;
};

export const sourceRegistry: SourceDefinition[] = [
  {
    key: "grants-gov",
    name: "Grants.gov",
    url: "https://www.grants.gov/",
    jurisdiction: "U.S. Federal",
    interfaceType: "api+xml",
    cadence: "daily",
  },
  {
    key: "simpler-grants",
    name: "Simpler.Grants.gov",
    url: "https://simpler.grants.gov/developers",
    jurisdiction: "U.S. Federal",
    interfaceType: "api",
    cadence: "daily",
  },
  {
    key: "sam-assistance",
    name: "SAM.gov Assistance Listings",
    url: "https://sam.gov/assistance-listings",
    jurisdiction: "U.S. Federal",
    interfaceType: "api+ui",
    cadence: "daily",
  },
  {
    key: "usajobs",
    name: "USAJOBS",
    url: "https://developer.usajobs.gov/",
    jurisdiction: "U.S. Federal",
    interfaceType: "api",
    cadence: "multiple-daily",
  },
  {
    key: "usaspending",
    name: "USAspending.gov",
    url: "https://api.usaspending.gov/",
    jurisdiction: "U.S. Federal",
    interfaceType: "api",
    cadence: "daily",
  },
  {
    key: "openfema",
    name: "OpenFEMA",
    url: "https://gis.fema.gov/",
    jurisdiction: "U.S. Federal",
    interfaceType: "api",
    cadence: "daily",
  },
  {
    key: "empleos-pr",
    name: "Empleos.pr.gov",
    url: "https://www.empleos.pr.gov/",
    jurisdiction: "Puerto Rico",
    interfaceType: "html",
    cadence: "daily",
  },
  {
    key: "adsef",
    name: "ADSEF Servicios en Linea",
    url: "https://serviciosenlinea.adsef.pr.gov/",
    jurisdiction: "Puerto Rico",
    interfaceType: "html+documents",
    cadence: "daily",
  },
  {
    key: "cdbg-recuperacion",
    name: "Recuperacion CDBG-DR/MIT",
    url: "https://recuperacion.pr.gov/programas/",
    jurisdiction: "Puerto Rico",
    interfaceType: "html+documents",
    cadence: "daily",
  },
  {
    key: "afv",
    name: "AFV / Puerto Rico Housing Finance Authority",
    url: "https://www.afv.pr.gov/home/",
    jurisdiction: "Puerto Rico",
    interfaceType: "html+notices",
    cadence: "daily",
  },
  {
    key: "ddec",
    name: "DDEC Program Pages",
    url: "https://incentives.ddec.pr.gov/",
    jurisdiction: "Puerto Rico",
    interfaceType: "html+portal",
    cadence: "daily",
  }
];
