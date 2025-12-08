import { INVENTORY_DATA } from './client/src/lib/data';

const medina = INVENTORY_DATA.find(b => b.id === 'medina');
const tabuk = INVENTORY_DATA.find(b => b.id === 'tabuk');

const calculateTotal = (branch) => {
  if (!branch) return { total: 0, vat: 0, grand: 0 };
  const total = branch.inventory.reduce((acc, item) => acc + ((item.price || 0) * item.quantity), 0);
  const vat = total * 0.15;
  return { total, vat, grand: total + vat };
};

const medinaStats = calculateTotal(medina);
const tabukStats = calculateTotal(tabuk);

console.log('Medina:', medinaStats);
console.log('Tabuk:', tabukStats);
console.log('Total:', {
    total: medinaStats.total + tabukStats.total,
    vat: medinaStats.vat + tabukStats.vat,
    grand: medinaStats.grand + tabukStats.grand
});
