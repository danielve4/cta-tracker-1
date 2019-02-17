import { Pipe, PipeTransform } from '@angular/core';
import { QueryValueType } from '@angular/core/src/view';

@Pipe({
  name: 'timeuntil'
})
export class TimeuntilPipe implements PipeTransform {

  transform(value: string, args?: string): string {
    if (args) {
      const minutes = parseInt(value);
      let valueReturned: string = value;
      switch (args) {
        case 'minutes':
          valueReturned = isNaN(parseInt(value)) ? value : value + 'm';
          break;
        case 'time':
          if (minutes || value.toLowerCase() === 'due') {
            let time: Date = new Date();
            time.setTime(new Date().getTime() + ((minutes || 0) * 60 * 1000));
            valueReturned = `
            ${(time.getHours() % 12) ? (time.getHours() % 12) : 12}:${('0' + time.getMinutes()).slice(-2)} ${time.getHours() >= 12 ? 'PM' : 'AM'}`;
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
