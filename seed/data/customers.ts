import type { CustomerAddress, CustomerStatus } from '../../src/modules/customers/customers.schema';
import { daysAgo } from '../time';

/** [name, phone (10 digits), area, city, pincode, status], from spareXAdmin/src/mocks/customers.ts. */
type CustomerRow = [string, string, string, string, string, CustomerStatus];

const CUSTOMERS: CustomerRow[] = [
  ['Arjun Rao', '9845012345', 'Whitefield', 'Bengaluru', '560066', 'active'],
  ['Sneha Kulkarni', '9880145678', 'Indiranagar', 'Bengaluru', '560038', 'active'],
  ['Rahul Menon', '9741234509', 'Koramangala', 'Bengaluru', '560034', 'active'],
  ['Divya Hegde', '9900345612', 'HSR Layout', 'Bengaluru', '560102', 'active'],
  ['Vikram Shetty', '9538456723', 'Jayanagar', 'Bengaluru', '560041', 'active'],
  ['Pooja Srinivas', '9611567834', 'Malleshwaram', 'Bengaluru', '560003', 'active'],
  ['Naveen Kumar', '9845678945', 'Electronic City', 'Bengaluru', '560100', 'active'],
  ['Lakshmi Prasad', '9880789056', 'Marathahalli', 'Bengaluru', '560037', 'active'],
  ['Imran Khan', '9741890167', 'Hebbal', 'Bengaluru', '560024', 'active'],
  ['Kavya Ramesh', '9900901278', 'Yelahanka', 'Bengaluru', '560064', 'active'],
  ['Siddharth Joshi', '9538012389', 'BTM Layout', 'Bengaluru', '560076', 'active'],
  ['Ayesha Siddiqui', '9611123490', 'JP Nagar', 'Bengaluru', '560078', 'active'],
  ['Manjunath Gowda', '9845234501', 'Rajajinagar', 'Bengaluru', '560010', 'active'],
  ['Deepa Nair', '9880345612', 'Banashankari', 'Bengaluru', '560070', 'active'],
  ['Karthik Subramanian', '9741456723', 'Bellandur', 'Bengaluru', '560103', 'active'],
  ['Anjali Deshpande', '9900567834', 'Sarjapur Road', 'Bengaluru', '560035', 'inactive'],
  ['Mohammed Faisal', '9538678945', 'Frazer Town', 'Bengaluru', '560005', 'active'],
  ['Shruti Bhat', '9611789056', 'Basavanagudi', 'Bengaluru', '560004', 'active'],
  ['Ganesh Murthy', '9845890167', 'Vijayanagar', 'Bengaluru', '560040', 'active'],
  ['Priyanka Reddy', '9880901278', 'Kalyan Nagar', 'Bengaluru', '560043', 'active'],
  ['Rohit Agarwal', '9741012389', 'Brookefield', 'Bengaluru', '560037', 'active'],
  ['Nisha Thomas', '9900123490', 'Domlur', 'Bengaluru', '560071', 'deletion_requested'],
  ['Santosh Patil', '9538234501', 'Hosur Road', 'Hosur', '635109', 'active'],
  ['Meghana Rao', '9611345612', 'Mathikere', 'Bengaluru', '560054', 'active'],
  ['Abhishek Singh', '9845456723', 'Kadugodi', 'Bengaluru', '560067', 'active'],
  ['Ramya Krishnan', '9880567834', 'Gokulam', 'Mysuru', '570002', 'active'],
  ['Sunil Naik', '9741678945', 'Kuvempunagar', 'Mysuru', '570023', 'active'],
  ['Farhana Begum', '9900789056', 'Shivajinagar', 'Bengaluru', '560051', 'active'],
  ['Prakash Hegde', '9538890167', 'RT Nagar', 'Bengaluru', '560032', 'inactive'],
  ['Varsha Iyengar', '9611901278', 'Basaveshwaranagar', 'Bengaluru', '560079', 'active'],
  ['Ajay Chandrashekar', '9845012390', 'Hennur', 'Bengaluru', '560043', 'active'],
  ['Bhavana Shenoy', '9880123401', 'Vidyaranyapura', 'Bengaluru', '560097', 'active'],
  ['Tejas Kamath', '9741234512', 'Mahadevapura', 'Bengaluru', '560048', 'active'],
  ['Rekha Venkatesh', '9900345623', 'Bilekahalli', 'Bengaluru', '560076', 'active'],
  ['Harish Babu', '9538456734', 'Bagalur Cross', 'Hosur', '635103', 'active'],
  ['Sowmya Gopal', '9611567845', 'Vijayanagar', 'Mysuru', '570017', 'active'],
  ['Nikhil Jain', '9845678956', 'Richmond Town', 'Bengaluru', '560025', 'active'],
  ['Chaitra Mahesh', '9880789067', 'Nagarbhavi', 'Bengaluru', '560072', 'inactive'],
  ['Yusuf Ali', '9741890178', 'Cox Town', 'Bengaluru', '560005', 'active'],
  ['Archana Pillai', '9900901289', 'Horamavu', 'Bengaluru', '560043', 'active'],
];

const STATE_BY_CITY: Record<string, string> = {
  Bengaluru: 'Karnataka',
  Mysuru: 'Karnataka',
  Hosur: 'Tamil Nadu',
};

type CustomerSeed = {
  _id: string;
  name: string;
  phone: string;
  email: string;
  gstin: null;
  status: CustomerStatus;
  addresses: CustomerAddress[];
  deletionRequestedAt: Date | null;
  deactivationReason: string | null;
  createdAt: Date;
};

/**
 * Arjun Rao is the B2C demo customer (spareXB2C/src/mocks/auth.ts and account.ts): he keeps the admin id
 * `cus_001`, which the admin's orders and vehicles link to, and the B2C address book with its ids.
 */
const ARJUN_ADDRESSES: CustomerAddress[] = [
  {
    _id: 'adr-home',
    label: 'Home',
    name: 'Arjun Rao',
    phone: '+919845012345',
    line1: 'Flat 304, Sai Krupa Residency, 4th Cross, ITPL Main Road',
    area: 'Whitefield',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560066',
    isDefault: true,
  },
  {
    _id: 'adr-work',
    label: 'Work',
    name: 'Arjun Rao',
    phone: '+919845012345',
    line1: '3rd Floor, Orion Business Park, Outer Ring Road',
    area: 'Marathahalli',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560037',
    isDefault: false,
  },
];

/** The admin mock's generated addresses; its `line2` ("Whitefield Main Road") is our `area`. */
function addressesFor(id: string, [name, phone, area, city, pincode]: CustomerRow, index: number) {
  const addresses: CustomerAddress[] = [
    {
      _id: `${id}_home`,
      label: 'Home',
      name,
      phone: `+91${phone}`,
      line1: `#${(Number(phone.slice(-3)) % 180) + 12}, ${(Number(phone.slice(-2)) % 14) + 1}th Cross`,
      area: `${area} Main Road`,
      city,
      state: STATE_BY_CITY[city] ?? 'Karnataka',
      pincode,
      isDefault: true,
    },
  ];
  if (index % 4 === 0) {
    addresses.push({
      _id: `${id}_work`,
      label: 'Work',
      name,
      phone: `+91${phone}`,
      line1: 'Prestige Shantiniketan, Tower B',
      area: 'ITPL Main Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560048',
      isDefault: false,
    });
  }
  return addresses;
}

export const CUSTOMERS_SEED: CustomerSeed[] = CUSTOMERS.map((row, index) => {
  const [name, phone, , , , status] = row;
  const id = `cus_${String(index + 1).padStart(3, '0')}`;
  const isArjun = index === 0;
  return {
    _id: id,
    name,
    phone: `+91${phone}`,
    email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`,
    gstin: null,
    status,
    addresses: isArjun ? ARJUN_ADDRESSES : addressesFor(id, row, index),
    deletionRequestedAt: status === 'deletion_requested' ? daysAgo(3, 21) : null,
    deactivationReason: status === 'inactive' ? 'Repeated failed COD deliveries' : null,
    createdAt: isArjun
      ? new Date('2025-11-04T18:32:00+05:30')
      : daysAgo(90 - index * 2, 10 + (index % 8)),
  };
});
