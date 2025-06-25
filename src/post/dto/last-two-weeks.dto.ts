export class LastTwoWeeksDto {
  day: 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7' | 'CN';
  previousWeek: number;
  beforePrevious: number;
}
