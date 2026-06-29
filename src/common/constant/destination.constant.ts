export enum DestinationType {
  TPA = 'TPA',
  RDF = 'RDF',
  TPS_3R = 'TPS_3R',
}

export const DESTINATION_TYPE_VALUES: readonly DestinationType[] =
  Object.freeze([
    DestinationType.TPA,
    DestinationType.RDF,
    DestinationType.TPS_3R,
  ]);

export const DEFAULT_DESTINATION_CAPACITY_KG = 5000;
export const DEFAULT_DESTINATION_PRIORITY = 3;
export const DEFAULT_SERVICE_MINUTES_BY_TYPE: Readonly<
  Record<DestinationType, number>
> = Object.freeze({
  [DestinationType.TPA]: 20,
  [DestinationType.RDF]: 15,
  [DestinationType.TPS_3R]: 10,
});