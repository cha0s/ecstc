import { string } from 'propertea';
import { expect, test } from 'vitest';

import { defineComponent, OnInitialize } from './component';

test('', () => {
  defineComponent(
    {
      x: string().default('asd'),
    },
    {
      decorator: (Component) => {
        return class extends Component {
          [OnInitialize]() {
            const x: string = this.x
            expect(x).to.equal('asd')
          }
        }
      },
    }
  )
})
