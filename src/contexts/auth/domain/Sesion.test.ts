import { describe, it, expect } from 'vitest';
import { Sesion } from './Sesion';

describe('Sesion', () => {
  const base = {
    token: 't',
    usuario: { id: 'u1', email: 'x@y.com', nombre: 'X' },
  };

  it('expone token y usuario', () => {
    const s = Sesion.create(base);
    expect(s.token).toBe('t');
    expect(s.usuario.id).toBe('u1');
  });

  it('rechaza sin token', () => {
    expect(() => Sesion.create({ ...base, token: '' })).toThrow(/token/);
  });

  it('rechaza sin id de usuario', () => {
    expect(() => Sesion.create({ ...base, usuario: { ...base.usuario, id: '' } })).toThrow(/usuario/);
  });

  it('toJSON devuelve clone superficial', () => {
    const s = Sesion.create(base);
    const json = s.toJSON();
    json.usuario.email = 'otro@y.com';
    expect(s.usuario.email).toBe('x@y.com');
  });
});
