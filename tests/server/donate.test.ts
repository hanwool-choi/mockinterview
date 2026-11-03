import { describe, it, expect } from 'vitest';
import { donateLinks } from '../../functions/api/config';

describe('donateLinks', () => {
  it('passes the official KakaoPay QR link and a Fairy link', () => {
    expect(donateLinks({ KAKAOPAY_URL: 'https://qr.kakaopay.com/Ej7lelIaG', FAIRY_URL: 'https://fairy.hada.io/p/modu' } as never)).toEqual({
      kakao: 'https://qr.kakaopay.com/Ej7lelIaG',
      fairy: 'https://fairy.hada.io/p/modu',
    });
  });
  it('drops anything that is not https on the expected host', () => {
    expect(donateLinks({ KAKAOPAY_URL: 'http://qr.kakaopay.com/x', FAIRY_URL: 'https://evil.example/fairy.hada.io' } as never)).toEqual({ kakao: '', fairy: '' });
    expect(donateLinks({ KAKAOPAY_URL: 'https://qr.kakaopay.com.evil.io/x' } as never)).toEqual({ kakao: '', fairy: '' });
    expect(donateLinks({} as never)).toEqual({ kakao: '', fairy: '' });
  });
});
