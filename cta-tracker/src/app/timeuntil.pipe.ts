import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'timeuntil'
})
export class TimeuntilPipe implements PipeTransform {

  transform(value: string, args?: string): string {
    if (args) {
      const minutes = parseInt(value, 10);
      let valueReturned: string = value;
      switch (args) {
        case 'minutes':
          valueReturned = isNaN(minutes) ? '' : 'min';
          break;
        case 'time':
          if (minutes || value.toLowerCase() === 'due') {
            const time: Date = new Date();
            time.setTime(new Date().getTime() + ((minutes || 0) * 60 * 1000));
            const hours = time.getHours() % 12 || 12;
            const mins = ('0' + time.getMinutes()).slice(-2);
            const period = time.getHours() >= 12 ? 'PM' : 'AM';
            valueReturned = `${hours}:${mins} ${period}`;
          } else {
            valueReturned = '--:--';
          }
          break;
      }
      return valueReturned;
    }
    return value;
  }
}
