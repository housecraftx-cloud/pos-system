from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Query
from fastapi.responses import FileResponse, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import aiomysql
import os
import logging
import json
import httpx
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import hashlib
import base64
import jwt

# Load environment variables
load_dotenv(Path(__file__).resolve().parent / ".env")

# Create FastAPI app
app = FastAPI(title="نظام المبيعات ZATCA")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Router
api_router = APIRouter(prefix="/api")

# MySQL Connection Pool
pool = None

MYSQL_HOST = os.environ.get("MYSQL_HOST", "localhost")
MYSQL_PORT = int(os.environ.get("MYSQL_PORT", 3306))
MYSQL_USER = os.environ.get("MYSQL_USER", "root")
MYSQL_PASSWORD = os.environ.get("MYSQL_PASSWORD", "")
MYSQL_DB = os.environ.get("MYSQL_DB", "pos_system")
JWT_SECRET = os.environ.get("JWT_SECRET", "zatca-pos-secret-key-2024")

# ============ DATABASE SETUP ============

async def get_pool():
    global pool
    if pool is None:
        pool = await aiomysql.create_pool(
            host=MYSQL_HOST,
            port=MYSQL_PORT,
            user=MYSQL_USER,
            password=MYSQL_PASSWORD,
            db=MYSQL_DB,
            charset='utf8mb4',
            autocommit=True,
            minsize=1,
            maxsize=10,
        )
    return pool

async def execute_query(query, args=None, fetch_one=False, fetch_all=False):
    p = await get_pool()
    async with p.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(query, args)
            if fetch_one:
                return await cur.fetchone()
            if fetch_all:
                return await cur.fetchall()
            return cur.lastrowid

async def init_tables():
    p = await get_pool()
    async with p.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id VARCHAR(36) PRIMARY KEY,
                    username VARCHAR(255) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    name VARCHAR(255),
                    role VARCHAR(50) DEFAULT 'user',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
            """)
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS products (
                    id VARCHAR(36) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    sku VARCHAR(100),
                    price DECIMAL(10,2) DEFAULT 0,
                    stock INT DEFAULT 0,
                    category VARCHAR(255),
                    barcode VARCHAR(255),
                    product_type VARCHAR(50) DEFAULT 'product',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
            """)
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS customers (
                    id VARCHAR(36) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    phone VARCHAR(50),
                    email VARCHAR(255),
                    address TEXT,
                    tax_number VARCHAR(100),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
            """)
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS invoices (
                    id VARCHAR(36) PRIMARY KEY,
                    invoice_number VARCHAR(50) UNIQUE,
                    customer_id VARCHAR(36),
                    customer_name VARCHAR(255),
                    customer_phone VARCHAR(50),
                    items JSON,
                    subtotal DECIMAL(10,2) DEFAULT 0,
                    discount DECIMAL(10,2) DEFAULT 0,
                    discount_type VARCHAR(20) DEFAULT 'amount',
                    vat_amount DECIMAL(10,2) DEFAULT 0,
                    total DECIMAL(10,2) DEFAULT 0,
                    payment_method VARCHAR(50) DEFAULT 'cash',
                    notes TEXT,
                    qr_data TEXT,
                    invoice_date VARCHAR(50),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
            """)
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS quotations (
                    id VARCHAR(36) PRIMARY KEY,
                    quote_number VARCHAR(50) UNIQUE,
                    customer_id VARCHAR(36),
                    customer_name VARCHAR(255),
                    customer_phone VARCHAR(50),
                    items JSON,
                    subtotal DECIMAL(10,2) DEFAULT 0,
                    discount DECIMAL(10,2) DEFAULT 0,
                    discount_type VARCHAR(20) DEFAULT 'amount',
                    vat_amount DECIMAL(10,2) DEFAULT 0,
                    total DECIMAL(10,2) DEFAULT 0,
                    notes TEXT,
                    validity_days INT DEFAULT 30,
                    status VARCHAR(50) DEFAULT 'draft',
                    valid_until DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
            """)
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS settings (
                    id INT PRIMARY KEY DEFAULT 1,
                    company_name VARCHAR(255) DEFAULT 'شركتي',
                    company_address TEXT,
                    company_phone VARCHAR(50),
                    company_vat_number VARCHAR(100),
                    company_cr_number VARCHAR(100),
                    company_logo TEXT,
                    show_logo TINYINT(1) DEFAULT 1,
                    vat_enabled TINYINT(1) DEFAULT 1,
                    vat_rate DECIMAL(5,2) DEFAULT 15.00,
                    invoice_header VARCHAR(255) DEFAULT 'فاتورة',
                    invoice_footer VARCHAR(255) DEFAULT 'شكراً لتعاملكم معنا',
                    invoice_terms TEXT,
                    primary_color VARCHAR(20) DEFAULT '#0F5132',
                    theme VARCHAR(20) DEFAULT 'light'
                ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
            """)
            # Insert default settings if not exists
            await cur.execute("SELECT id FROM settings WHERE id=1")
            if not await cur.fetchone():
                await cur.execute("INSERT INTO settings (id) VALUES (1)")

# ============ PYDANTIC MODELS ============

class UserRegister(BaseModel):
    username: str
    password: str
    name: str = ""

class UserLogin(BaseModel):
    username: str
    password: str

class ProductCreate(BaseModel):
    name: str
    sku: str = ""
    price: float = 0
    stock: int = 0
    category: str = ""
    barcode: str = ""
    product_type: str = "product"

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    price: Optional[float] = None
    stock: Optional[int] = None
    category: Optional[str] = None
    barcode: Optional[str] = None
    product_type: Optional[str] = None

class CustomerCreate(BaseModel):
    name: str
    phone: str = ""
    email: str = ""
    address: str = ""
    tax_number: str = ""

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    tax_number: Optional[str] = None

class QuickCustomerCreate(BaseModel):
    name: str
    phone: str

class InvoiceItem(BaseModel):
    product_id: Optional[str] = None
    product_name: str
    quantity: int = 1
    price: float = 0
    total: float = 0
    is_manual: bool = False

class InvoiceCreate(BaseModel):
    customer_id: Optional[str] = None
    customer_name: str = "عميل نقدي"
    customer_phone: str = ""
    items: List[InvoiceItem]
    payment_method: str = "cash"
    discount: float = 0
    discount_type: str = "amount"
    invoice_date: Optional[str] = None
    notes: str = ""

class InvoiceUpdate(BaseModel):
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    items: Optional[List[InvoiceItem]] = None
    payment_method: Optional[str] = None
    discount: Optional[float] = None
    discount_type: Optional[str] = None
    invoice_date: Optional[str] = None
    notes: Optional[str] = None

class QuotationCreate(BaseModel):
    customer_id: Optional[str] = None
    customer_name: str = "عميل نقدي"
    customer_phone: str = ""
    items: List[InvoiceItem]
    discount: float = 0
    discount_type: str = "amount"
    notes: str = ""
    validity_days: int = 30

class QuotationUpdate(BaseModel):
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    items: Optional[List[InvoiceItem]] = None
    discount: Optional[float] = None
    discount_type: Optional[str] = None
    notes: Optional[str] = None
    validity_days: Optional[int] = None
    status: Optional[str] = None

class SettingsUpdate(BaseModel):
    company_name: Optional[str] = None
    company_address: Optional[str] = None
    company_phone: Optional[str] = None
    company_vat_number: Optional[str] = None
    company_cr_number: Optional[str] = None
    company_logo: Optional[str] = None
    show_logo: Optional[bool] = None
    vat_enabled: Optional[bool] = None
    vat_rate: Optional[float] = None
    invoice_header: Optional[str] = None
    invoice_footer: Optional[str] = None
    invoice_terms: Optional[str] = None
    primary_color: Optional[str] = None
    theme: Optional[str] = None

# ============ HELPERS ============

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def create_token(user_id: str, username: str) -> str:
    return jwt.encode({"user_id": user_id, "username": username, "exp": datetime.now(timezone.utc) + timedelta(days=30)}, JWT_SECRET, algorithm="HS256")

def verify_token(token: str):
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="انتهت صلاحية الجلسة")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="جلسة غير صالحة")

def generate_invoice_number() -> str:
    now = datetime.now(timezone.utc)
    return f"INV-{now.strftime('%y%m%d')}-{str(uuid.uuid4())[:4].upper()}"

def generate_quote_number() -> str:
    now = datetime.now(timezone.utc)
    return f"QT-{now.strftime('%y%m%d')}-{str(uuid.uuid4())[:4].upper()}"

def generate_zatca_qr(seller_name, vat_number, timestamp, total, vat_amount):
    def tlv(tag, value):
        value_bytes = str(value).encode('utf-8')
        return bytes([tag, len(value_bytes)]) + value_bytes
    qr_data = tlv(1, seller_name) + tlv(2, vat_number) + tlv(3, timestamp) + tlv(4, f"{total:.2f}") + tlv(5, f"{vat_amount:.2f}")
    return base64.b64encode(qr_data).decode('utf-8')

async def get_settings():
    row = await execute_query("SELECT * FROM settings WHERE id=1", fetch_one=True)
    if row:
        row['vat_enabled'] = bool(row.get('vat_enabled', 1))
        row['show_logo'] = bool(row.get('show_logo', 1))
        row['vat_rate'] = float(row.get('vat_rate', 15))
        return row
    return {"company_name": "شركتي", "vat_enabled": True, "vat_rate": 15.0, "show_logo": True}

def parse_items(items_data):
    if isinstance(items_data, str):
        return json.loads(items_data)
    return items_data or []

def format_decimal(val):
    if val is None:
        return 0
    return float(val)

# ============ AUTH ROUTES ============

@api_router.post("/auth/register")
async def register(user: UserRegister):
    existing = await execute_query("SELECT id FROM users WHERE username=%s", (user.username,), fetch_one=True)
    if existing:
        raise HTTPException(status_code=400, detail="اسم المستخدم موجود مسبقاً")
    user_id = str(uuid.uuid4())
    await execute_query(
        "INSERT INTO users (id, username, password, name, role) VALUES (%s, %s, %s, %s, %s)",
        (user_id, user.username, hash_password(user.password), user.name, "user")
    )
    token = create_token(user_id, user.username)
    return {"token": token, "user": {"id": user_id, "username": user.username, "name": user.name, "role": "user"}}

@api_router.post("/auth/login")
async def login(user: UserLogin):
    row = await execute_query("SELECT * FROM users WHERE username=%s", (user.username,), fetch_one=True)
    if not row or row["password"] != hash_password(user.password):
        raise HTTPException(status_code=401, detail="بيانات الدخول غير صحيحة")
    token = create_token(row["id"], row["username"])
    return {"token": token, "user": {"id": row["id"], "username": row["username"], "name": row.get("name", ""), "role": row.get("role", "user")}}

@api_router.get("/auth/me")
async def get_me(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="غير مصرح")
    payload = verify_token(authorization.split(" ")[1])
    user = await execute_query("SELECT id, username, name, role FROM users WHERE id=%s", (payload["user_id"],), fetch_one=True)
    if not user:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    return user

# ============ PRODUCTS ROUTES ============

@api_router.get("/products")
async def get_products():
    rows = await execute_query("SELECT * FROM products ORDER BY created_at DESC", fetch_all=True)
    for r in rows:
        r['price'] = format_decimal(r['price'])
    return rows

@api_router.post("/products")
async def create_product(product: ProductCreate):
    product_id = str(uuid.uuid4())
    sku = product.sku or f"SKU-{str(uuid.uuid4())[:6].upper()}"
    await execute_query(
        "INSERT INTO products (id, name, sku, price, stock, category, barcode, product_type) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
        (product_id, product.name, sku, product.price, product.stock, product.category, product.barcode, product.product_type)
    )
    return {"id": product_id, "name": product.name, "sku": sku, "price": product.price, "stock": product.stock, "category": product.category, "barcode": product.barcode, "product_type": product.product_type}

@api_router.get("/products/generate-sku")
async def generate_sku():
    return {"sku": f"SKU-{str(uuid.uuid4())[:6].upper()}"}

@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    row = await execute_query("SELECT * FROM products WHERE id=%s", (product_id,), fetch_one=True)
    if not row:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")
    row['price'] = format_decimal(row['price'])
    return row

@api_router.put("/products/{product_id}")
async def update_product(product_id: str, product: ProductUpdate):
    existing = await execute_query("SELECT id FROM products WHERE id=%s", (product_id,), fetch_one=True)
    if not existing:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")
    updates = []
    values = []
    for key, value in product.model_dump().items():
        if value is not None:
            updates.append(f"{key}=%s")
            values.append(value)
    if updates:
        values.append(product_id)
        await execute_query(f"UPDATE products SET {', '.join(updates)} WHERE id=%s", tuple(values))
    row = await execute_query("SELECT * FROM products WHERE id=%s", (product_id,), fetch_one=True)
    row['price'] = format_decimal(row['price'])
    return row

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str):
    result = await execute_query("DELETE FROM products WHERE id=%s", (product_id,))
    return {"message": "تم حذف المنتج بنجاح"}

# ============ CUSTOMERS ROUTES ============

@api_router.get("/customers")
async def get_customers():
    return await execute_query("SELECT * FROM customers ORDER BY created_at DESC", fetch_all=True) or []

@api_router.get("/customers/search")
async def search_customers(q: str = ""):
    if not q:
        return []
    rows = await execute_query("SELECT * FROM customers WHERE name LIKE %s OR phone LIKE %s LIMIT 20", (f"%{q}%", f"%{q}%"), fetch_all=True)
    return rows or []

@api_router.post("/customers/quick")
async def create_quick_customer(customer: QuickCustomerCreate):
    existing = await execute_query("SELECT * FROM customers WHERE phone=%s", (customer.phone,), fetch_one=True)
    if existing:
        return existing
    customer_id = str(uuid.uuid4())
    await execute_query(
        "INSERT INTO customers (id, name, phone) VALUES (%s, %s, %s)",
        (customer_id, customer.name, customer.phone)
    )
    return {"id": customer_id, "name": customer.name, "phone": customer.phone, "email": "", "address": "", "tax_number": ""}

@api_router.post("/customers")
async def create_customer(customer: CustomerCreate):
    customer_id = str(uuid.uuid4())
    await execute_query(
        "INSERT INTO customers (id, name, phone, email, address, tax_number) VALUES (%s,%s,%s,%s,%s,%s)",
        (customer_id, customer.name, customer.phone, customer.email, customer.address, customer.tax_number)
    )
    return {"id": customer_id, "name": customer.name, "phone": customer.phone, "email": customer.email, "address": customer.address, "tax_number": customer.tax_number}

@api_router.get("/customers/{customer_id}")
async def get_customer(customer_id: str):
    row = await execute_query("SELECT * FROM customers WHERE id=%s", (customer_id,), fetch_one=True)
    if not row:
        raise HTTPException(status_code=404, detail="العميل غير موجود")
    return row

@api_router.put("/customers/{customer_id}")
async def update_customer(customer_id: str, customer: CustomerUpdate):
    existing = await execute_query("SELECT id FROM customers WHERE id=%s", (customer_id,), fetch_one=True)
    if not existing:
        raise HTTPException(status_code=404, detail="العميل غير موجود")
    updates = []
    values = []
    for key, value in customer.model_dump().items():
        if value is not None:
            updates.append(f"{key}=%s")
            values.append(value)
    if updates:
        values.append(customer_id)
        await execute_query(f"UPDATE customers SET {', '.join(updates)} WHERE id=%s", tuple(values))
    return await execute_query("SELECT * FROM customers WHERE id=%s", (customer_id,), fetch_one=True)

@api_router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str):
    await execute_query("DELETE FROM customers WHERE id=%s", (customer_id,))
    return {"message": "تم حذف العميل بنجاح"}

# ============ INVOICES ROUTES ============

@api_router.get("/invoices")
async def get_invoices():
    rows = await execute_query("SELECT * FROM invoices ORDER BY created_at DESC", fetch_all=True) or []
    for r in rows:
        r['items'] = parse_items(r.get('items'))
        r['subtotal'] = format_decimal(r['subtotal'])
        r['discount'] = format_decimal(r['discount'])
        r['vat_amount'] = format_decimal(r['vat_amount'])
        r['total'] = format_decimal(r['total'])
    return rows

@api_router.get("/invoices/{invoice_id}")
async def get_invoice(invoice_id: str):
    row = await execute_query("SELECT * FROM invoices WHERE id=%s", (invoice_id,), fetch_one=True)
    if not row:
        raise HTTPException(status_code=404, detail="الفاتورة غير موجودة")
    row['items'] = parse_items(row.get('items'))
    row['subtotal'] = format_decimal(row['subtotal'])
    row['discount'] = format_decimal(row['discount'])
    row['vat_amount'] = format_decimal(row['vat_amount'])
    row['total'] = format_decimal(row['total'])
    return row

@api_router.post("/invoices")
async def create_invoice(invoice: InvoiceCreate):
    settings = await get_settings()
    subtotal = sum(item.total for item in invoice.items)
    discount_amount = invoice.discount
    if invoice.discount_type == "percentage":
        discount_amount = subtotal * (invoice.discount / 100)
    subtotal_after_discount = subtotal - discount_amount
    vat_amount = subtotal_after_discount * (settings["vat_rate"] / 100) if settings["vat_enabled"] else 0
    total = subtotal_after_discount + vat_amount
    timestamp = invoice.invoice_date or datetime.now(timezone.utc).isoformat()
    invoice_number = generate_invoice_number()
    qr_data = generate_zatca_qr(
        settings.get("company_name", ""),
        settings.get("company_vat_number", "") if settings["vat_enabled"] else "",
        timestamp, total, vat_amount
    )
    invoice_id = str(uuid.uuid4())
    items_json = json.dumps([item.model_dump() for item in invoice.items], ensure_ascii=False)
    await execute_query(
        """INSERT INTO invoices (id, invoice_number, customer_id, customer_name, customer_phone, items, subtotal, discount, discount_type, vat_amount, total, payment_method, notes, qr_data, invoice_date)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
        (invoice_id, invoice_number, invoice.customer_id, invoice.customer_name, invoice.customer_phone,
         items_json, subtotal, discount_amount, invoice.discount_type, vat_amount, total,
         invoice.payment_method, invoice.notes, qr_data, timestamp)
    )
    # Update stock
    for item in invoice.items:
        if item.product_id and not item.is_manual:
            product = await execute_query("SELECT product_type, stock FROM products WHERE id=%s", (item.product_id,), fetch_one=True)
            if product and product.get("product_type") != "service":
                await execute_query("UPDATE products SET stock=stock-%s WHERE id=%s", (item.quantity, item.product_id))
    return {"id": invoice_id, "invoice_number": invoice_number, "customer_id": invoice.customer_id,
            "customer_name": invoice.customer_name, "customer_phone": invoice.customer_phone,
            "items": [item.model_dump() for item in invoice.items], "subtotal": subtotal,
            "discount": discount_amount, "discount_type": invoice.discount_type,
            "vat_amount": vat_amount, "total": total, "payment_method": invoice.payment_method,
            "notes": invoice.notes, "qr_data": qr_data, "created_at": timestamp}

@api_router.put("/invoices/{invoice_id}")
async def update_invoice(invoice_id: str, invoice_update: InvoiceUpdate):
    existing = await execute_query("SELECT * FROM invoices WHERE id=%s", (invoice_id,), fetch_one=True)
    if not existing:
        raise HTTPException(status_code=404, detail="الفاتورة غير موجودة")
    settings = await get_settings()
    updates = []
    values = []
    update_data = {}
    for key, value in invoice_update.model_dump().items():
        if value is not None:
            update_data[key] = value

    if "items" in update_data:
        items = update_data["items"]
        items_list = [item.model_dump() if hasattr(item, 'model_dump') else item for item in items]
        subtotal = sum(it.get("total", 0) if isinstance(it, dict) else it.total for it in items)
        discount = update_data.get("discount", format_decimal(existing.get("discount", 0)))
        discount_type = update_data.get("discount_type", existing.get("discount_type", "amount"))
        discount_amount = discount
        if discount_type == "percentage":
            discount_amount = subtotal * (discount / 100)
        subtotal_after_discount = subtotal - discount_amount
        vat_amount = subtotal_after_discount * (settings["vat_rate"] / 100) if settings["vat_enabled"] else 0
        total = subtotal_after_discount + vat_amount
        timestamp = update_data.get("invoice_date", existing.get("invoice_date", datetime.now(timezone.utc).isoformat()))
        qr_data = generate_zatca_qr(
            settings.get("company_name", ""),
            settings.get("company_vat_number", "") if settings["vat_enabled"] else "",
            timestamp, total, vat_amount
        )
        updates.extend(["items=%s", "subtotal=%s", "discount=%s", "discount_type=%s", "vat_amount=%s", "total=%s", "qr_data=%s"])
        values.extend([json.dumps(items_list, ensure_ascii=False), subtotal, discount_amount, discount_type, vat_amount, total, qr_data])

    for key in ["customer_id", "customer_name", "customer_phone", "payment_method", "notes", "invoice_date"]:
        if key in update_data:
            updates.append(f"{key}=%s")
            values.append(update_data[key])

    if updates:
        values.append(invoice_id)
        await execute_query(f"UPDATE invoices SET {', '.join(updates)} WHERE id=%s", tuple(values))

    row = await execute_query("SELECT * FROM invoices WHERE id=%s", (invoice_id,), fetch_one=True)
    row['items'] = parse_items(row.get('items'))
    row['subtotal'] = format_decimal(row['subtotal'])
    row['discount'] = format_decimal(row['discount'])
    row['vat_amount'] = format_decimal(row['vat_amount'])
    row['total'] = format_decimal(row['total'])
    return row

# ============ QUOTATIONS ROUTES ============

@api_router.get("/quotations")
async def get_quotations():
    rows = await execute_query("SELECT * FROM quotations ORDER BY created_at DESC", fetch_all=True) or []
    for r in rows:
        r['items'] = parse_items(r.get('items'))
        r['subtotal'] = format_decimal(r['subtotal'])
        r['discount'] = format_decimal(r['discount'])
        r['vat_amount'] = format_decimal(r['vat_amount'])
        r['total'] = format_decimal(r['total'])
        r['valid_until'] = r['valid_until'].isoformat() if r.get('valid_until') else ""
        r['created_at'] = r['created_at'].isoformat() if isinstance(r.get('created_at'), datetime) else str(r.get('created_at', ''))
    return rows

@api_router.get("/quotations/{quote_id}")
async def get_quotation(quote_id: str):
    row = await execute_query("SELECT * FROM quotations WHERE id=%s", (quote_id,), fetch_one=True)
    if not row:
        raise HTTPException(status_code=404, detail="عرض السعر غير موجود")
    row['items'] = parse_items(row.get('items'))
    row['subtotal'] = format_decimal(row['subtotal'])
    row['discount'] = format_decimal(row['discount'])
    row['vat_amount'] = format_decimal(row['vat_amount'])
    row['total'] = format_decimal(row['total'])
    row['valid_until'] = row['valid_until'].isoformat() if row.get('valid_until') else ""
    row['created_at'] = row['created_at'].isoformat() if isinstance(row.get('created_at'), datetime) else str(row.get('created_at', ''))
    return row

@api_router.post("/quotations")
async def create_quotation(quotation: QuotationCreate):
    settings = await get_settings()
    subtotal = sum(item.total for item in quotation.items)
    discount_amount = quotation.discount
    if quotation.discount_type == "percentage":
        discount_amount = subtotal * (quotation.discount / 100)
    subtotal_after_discount = subtotal - discount_amount
    vat_amount = subtotal_after_discount * (settings["vat_rate"] / 100) if settings["vat_enabled"] else 0
    total = subtotal_after_discount + vat_amount
    now = datetime.now(timezone.utc)
    valid_until = now + timedelta(days=quotation.validity_days)
    quote_id = str(uuid.uuid4())
    items_json = json.dumps([item.model_dump() for item in quotation.items], ensure_ascii=False)
    await execute_query(
        """INSERT INTO quotations (id, quote_number, customer_id, customer_name, customer_phone, items, subtotal, discount, discount_type, vat_amount, total, notes, validity_days, status, valid_until)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
        (quote_id, generate_quote_number(), quotation.customer_id, quotation.customer_name, quotation.customer_phone,
         items_json, subtotal, discount_amount, quotation.discount_type, vat_amount, total,
         quotation.notes, quotation.validity_days, "draft", valid_until)
    )
    row = await execute_query("SELECT * FROM quotations WHERE id=%s", (quote_id,), fetch_one=True)
    row['items'] = parse_items(row.get('items'))
    row['subtotal'] = format_decimal(row['subtotal'])
    row['discount'] = format_decimal(row['discount'])
    row['vat_amount'] = format_decimal(row['vat_amount'])
    row['total'] = format_decimal(row['total'])
    row['valid_until'] = row['valid_until'].isoformat() if row.get('valid_until') else ""
    row['created_at'] = row['created_at'].isoformat() if isinstance(row.get('created_at'), datetime) else str(row.get('created_at', ''))
    return row

@api_router.put("/quotations/{quote_id}")
async def update_quotation(quote_id: str, quotation_update: QuotationUpdate):
    existing = await execute_query("SELECT * FROM quotations WHERE id=%s", (quote_id,), fetch_one=True)
    if not existing:
        raise HTTPException(status_code=404, detail="عرض السعر غير موجود")
    settings = await get_settings()
    updates = []
    values = []
    update_data = {}
    for key, value in quotation_update.model_dump().items():
        if value is not None:
            update_data[key] = value

    if "items" in update_data:
        items = update_data["items"]
        items_list = [item.model_dump() if hasattr(item, 'model_dump') else item for item in items]
        subtotal = sum(it.get("total", 0) if isinstance(it, dict) else it.total for it in items)
        discount = update_data.get("discount", format_decimal(existing.get("discount", 0)))
        discount_type = update_data.get("discount_type", existing.get("discount_type", "amount"))
        discount_amount = discount
        if discount_type == "percentage":
            discount_amount = subtotal * (discount / 100)
        subtotal_after_discount = subtotal - discount_amount
        vat_amount = subtotal_after_discount * (settings["vat_rate"] / 100) if settings["vat_enabled"] else 0
        total = subtotal_after_discount + vat_amount
        updates.extend(["items=%s", "subtotal=%s", "discount=%s", "discount_type=%s", "vat_amount=%s", "total=%s"])
        values.extend([json.dumps(items_list, ensure_ascii=False), subtotal, discount_amount, discount_type, vat_amount, total])

    for key in ["customer_id", "customer_name", "customer_phone", "notes", "status"]:
        if key in update_data:
            updates.append(f"{key}=%s")
            values.append(update_data[key])

    if "validity_days" in update_data:
        updates.append("validity_days=%s")
        values.append(update_data["validity_days"])
        created = existing.get("created_at")
        if isinstance(created, str):
            created = datetime.fromisoformat(created.replace("Z", "+00:00"))
        updates.append("valid_until=%s")
        values.append(created + timedelta(days=update_data["validity_days"]))

    if updates:
        values.append(quote_id)
        await execute_query(f"UPDATE quotations SET {', '.join(updates)} WHERE id=%s", tuple(values))

    row = await execute_query("SELECT * FROM quotations WHERE id=%s", (quote_id,), fetch_one=True)
    row['items'] = parse_items(row.get('items'))
    row['subtotal'] = format_decimal(row['subtotal'])
    row['discount'] = format_decimal(row['discount'])
    row['vat_amount'] = format_decimal(row['vat_amount'])
    row['total'] = format_decimal(row['total'])
    row['valid_until'] = row['valid_until'].isoformat() if row.get('valid_until') else ""
    row['created_at'] = row['created_at'].isoformat() if isinstance(row.get('created_at'), datetime) else str(row.get('created_at', ''))
    return row

@api_router.delete("/quotations/{quote_id}")
async def delete_quotation(quote_id: str):
    await execute_query("DELETE FROM quotations WHERE id=%s", (quote_id,))
    return {"message": "تم حذف عرض السعر بنجاح"}

@api_router.post("/quotations/{quote_id}/convert")
async def convert_quotation_to_invoice(quote_id: str):
    row = await execute_query("SELECT * FROM quotations WHERE id=%s", (quote_id,), fetch_one=True)
    if not row:
        raise HTTPException(status_code=404, detail="عرض السعر غير موجود")
    settings = await get_settings()
    items = parse_items(row.get('items'))
    subtotal = format_decimal(row['subtotal'])
    discount = format_decimal(row['discount'])
    subtotal_after_discount = subtotal - discount
    vat_amount = subtotal_after_discount * (settings["vat_rate"] / 100) if settings["vat_enabled"] else 0
    total = subtotal_after_discount + vat_amount
    timestamp = datetime.now(timezone.utc).isoformat()
    invoice_number = generate_invoice_number()
    qr_data = generate_zatca_qr(
        settings.get("company_name", ""),
        settings.get("company_vat_number", "") if settings["vat_enabled"] else "",
        timestamp, total, vat_amount
    )
    invoice_id = str(uuid.uuid4())
    items_json = json.dumps(items, ensure_ascii=False) if isinstance(items, list) else items
    await execute_query(
        """INSERT INTO invoices (id, invoice_number, customer_id, customer_name, customer_phone, items, subtotal, discount, discount_type, vat_amount, total, payment_method, notes, qr_data, invoice_date)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
        (invoice_id, invoice_number, row.get('customer_id'), row['customer_name'], row.get('customer_phone', ''),
         items_json, subtotal, discount, row.get('discount_type', 'amount'), vat_amount, total,
         "cash", row.get('notes', ''), qr_data, timestamp)
    )
    await execute_query("UPDATE quotations SET status='converted' WHERE id=%s", (quote_id,))
    # Update stock
    for item in items:
        if item.get("product_id") and not item.get("is_manual"):
            product = await execute_query("SELECT product_type FROM products WHERE id=%s", (item["product_id"],), fetch_one=True)
            if product and product.get("product_type") != "service":
                await execute_query("UPDATE products SET stock=stock-%s WHERE id=%s", (item.get("quantity", 1), item["product_id"]))
    return {"id": invoice_id, "invoice_number": invoice_number, "customer_id": row.get('customer_id'),
            "customer_name": row['customer_name'], "customer_phone": row.get('customer_phone', ''),
            "items": items, "subtotal": subtotal, "discount": discount,
            "discount_type": row.get('discount_type', 'amount'), "vat_amount": vat_amount,
            "total": total, "payment_method": "cash", "notes": row.get('notes', ''),
            "qr_data": qr_data, "created_at": timestamp}

# ============ SETTINGS ROUTES ============

@api_router.get("/settings")
async def get_settings_route():
    return await get_settings()

@api_router.put("/settings")
async def update_settings(settings_update: SettingsUpdate):
    updates = []
    values = []
    for key, value in settings_update.model_dump().items():
        if value is not None:
            updates.append(f"{key}=%s")
            if isinstance(value, bool):
                values.append(1 if value else 0)
            else:
                values.append(value)
    if updates:
        await execute_query(f"UPDATE settings SET {', '.join(updates)} WHERE id=1", tuple(values))
    return await get_settings()

# ============ DASHBOARD & REPORTS ============

@api_router.get("/dashboard/stats")
async def get_dashboard_stats():
    products_count = await execute_query("SELECT COUNT(*) as count FROM products", fetch_one=True)
    customers_count = await execute_query("SELECT COUNT(*) as count FROM customers", fetch_one=True)
    invoices_count = await execute_query("SELECT COUNT(*) as count FROM invoices", fetch_one=True)
    total_sales = await execute_query("SELECT COALESCE(SUM(total), 0) as total FROM invoices", fetch_one=True)
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    today_sales = await execute_query("SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as count FROM invoices WHERE DATE(created_at)=%s", (today,), fetch_one=True)
    low_stock = await execute_query("SELECT COUNT(*) as count FROM products WHERE stock <= 5 AND product_type='product'", fetch_one=True)
    recent_invoices = await execute_query("SELECT * FROM invoices ORDER BY created_at DESC LIMIT 5", fetch_all=True) or []
    for r in recent_invoices:
        r['items'] = parse_items(r.get('items'))
        r['subtotal'] = format_decimal(r['subtotal'])
        r['discount'] = format_decimal(r['discount'])
        r['vat_amount'] = format_decimal(r['vat_amount'])
        r['total'] = format_decimal(r['total'])
    return {
        "products_count": products_count['count'] if products_count else 0,
        "customers_count": customers_count['count'] if customers_count else 0,
        "invoices_count": invoices_count['count'] if invoices_count else 0,
        "total_sales": format_decimal(total_sales['total']) if total_sales else 0,
        "today_sales": format_decimal(today_sales['total']) if today_sales else 0,
        "today_invoices": today_sales['count'] if today_sales else 0,
        "low_stock_count": low_stock['count'] if low_stock else 0,
        "recent_invoices": recent_invoices,
    }

@api_router.get("/reports/sales")
async def get_sales_report(period: str = "month"):
    if period == "week":
        date_from = (datetime.now(timezone.utc) - timedelta(days=7)).strftime('%Y-%m-%d')
    elif period == "year":
        date_from = (datetime.now(timezone.utc) - timedelta(days=365)).strftime('%Y-%m-%d')
    else:
        date_from = (datetime.now(timezone.utc) - timedelta(days=30)).strftime('%Y-%m-%d')

    rows = await execute_query(
        "SELECT DATE(created_at) as date, SUM(total) as total, COUNT(*) as count FROM invoices WHERE DATE(created_at) >= %s GROUP BY DATE(created_at) ORDER BY date",
        (date_from,), fetch_all=True
    ) or []
    daily_sales = []
    for r in rows:
        daily_sales.append({
            "date": r['date'].isoformat() if hasattr(r['date'], 'isoformat') else str(r['date']),
            "total": format_decimal(r['total']),
            "count": r['count']
        })
    total_row = await execute_query("SELECT COALESCE(SUM(total),0) as total, COALESCE(SUM(vat_amount),0) as vat, COUNT(*) as count FROM invoices WHERE DATE(created_at) >= %s", (date_from,), fetch_one=True)
    payment_rows = await execute_query("SELECT payment_method, SUM(total) as total, COUNT(*) as count FROM invoices WHERE DATE(created_at) >= %s GROUP BY payment_method", (date_from,), fetch_all=True) or []
    payment_summary = {}
    for pr in payment_rows:
        payment_summary[pr['payment_method']] = {"total": format_decimal(pr['total']), "count": pr['count']}
    top_products = await execute_query(
        "SELECT * FROM invoices WHERE DATE(created_at) >= %s", (date_from,), fetch_all=True
    ) or []
    product_sales = {}
    for inv in top_products:
        items = parse_items(inv.get('items'))
        for item in items:
            pname = item.get('product_name', 'غير معروف')
            if pname not in product_sales:
                product_sales[pname] = {"name": pname, "quantity": 0, "total": 0}
            product_sales[pname]["quantity"] += item.get('quantity', 0)
            product_sales[pname]["total"] += item.get('total', 0)
    top_products_list = sorted(product_sales.values(), key=lambda x: x['total'], reverse=True)[:10]
    return {
        "daily_sales": daily_sales,
        "total_sales": format_decimal(total_row['total']) if total_row else 0,
        "total_vat": format_decimal(total_row['vat']) if total_row else 0,
        "total_invoices": total_row['count'] if total_row else 0,
        "payment_summary": payment_summary,
        "top_products": top_products_list,
    }

# ============ DOWNLOAD ============

@app.get("/api/download/project")
async def download_project():
    file_path = "/app/project-pos-system.zip"
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="الملف غير موجود")
    return FileResponse(file_path, filename="pos-system.zip", media_type="application/zip")

# ============ IMAGE PROXY ============

@api_router.get("/proxy-image")
async def proxy_image(url: str = Query(...)):
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                content_type = resp.headers.get("content-type", "image/png")
                return Response(content=resp.content, media_type=content_type, headers={"Cache-Control": "public, max-age=86400"})
        raise HTTPException(status_code=404, detail="Image not found")
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to fetch image")

# ============ ROOT ============

@api_router.get("/")
async def root():
    return {"message": "نظام المبيعات ZATCA - مرحباً"}

# Include router
app.include_router(api_router)

# Startup & Shutdown
@app.on_event("startup")
async def startup():
    await init_tables()
    logging.info("MySQL tables initialized")

@app.on_event("shutdown")
async def shutdown():
    global pool
    if pool:
        pool.close()
        await pool.wait_closed()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.get("/api/download/frontend")
async def download_frontend():
    file_path = "/app/frontend-build.zip"
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="الملف غير موجود")
    return FileResponse(file_path, filename="frontend-build.zip", media_type="application/zip")
