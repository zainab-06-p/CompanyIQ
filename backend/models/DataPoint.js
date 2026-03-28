export const DataStatus = {
  FETCHED: 'FETCHED',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
  FETCH_FAILED: 'FETCH_FAILED'
};

export class DataPoint {
  constructor(value, status = DataStatus.FETCHED, source = '', fetchedAt = new Date()) {
    this.value = value;
    this.status = status;
    this.source = source;
    this.fetchedAt = fetchedAt;
    this.retryCount = 0;
  }
}
