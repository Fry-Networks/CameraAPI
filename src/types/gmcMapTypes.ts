export interface RowData {
  date: string;
  cpm: string;
  acpm: string;
  usv_h: string;
  latitude: string;
  longitude: string;
}

export interface ApiResponse {
    status: 'SUCCESS' | 'ERROR';
    message: string;
    data?: any;
    error?: any;
  }