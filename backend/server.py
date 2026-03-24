from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import hashlib
import base64
import jwt
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Secret
JWT_SECRET = os.environ.get('JWT_SECRET', 'zatca-pos-secret-key-2024')

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ============ MODELS ============

class UserCreate(BaseModel):
    username: str
    password: str
    name: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    username: str
    name: str
    role: str = "admin"

class ProductCreate(BaseModel):
    name: str
    sku: str = ""  # Can be auto-generated
    price: float
    stock: int = 0
    category: str = ""
    description: str = ""
    product_type: str = "product"  # product or service

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    price: Optional[float] = None
    stock: Optional[int] = None
    category: Optional[str] = None
    description: Optional[str] = None
    product_type: Optional[str] = None

class ProductResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    sku: str
    price: float
    stock: int
    category: str
    description: str
    product_type: str
    created_at: str

class CustomerCreate(BaseModel):
    name: str
    phone: str = ""
    email: str = ""
    address: str = ""
    vat_number: str = ""

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    vat_number: Optional[str] = None

class CustomerResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    phone: str
    email: str
    address: str
    vat_number: str
    created_at: str

class InvoiceItem(BaseModel):
    product_id: Optional[str] = None
    product_name: str
    quantity: int
    price: float
    total: float
    is_manual: bool = False  # For manually entered items

class InvoiceCreate(BaseModel):
    customer_id: Optional[str] = None
    customer_name: str = "عميل نقدي"
    customer_phone: str = ""
    items: List[InvoiceItem]
    payment_method: str = "cash"  # cash or card
    discount: float = 0  # Discount amount
    discount_type: str = "amount"  # amount or percentage
    invoice_date: Optional[str] = None  # Custom invoice date
    notes: str = ""

class InvoiceResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    invoice_number: str
    customer_id: Optional[str]
    customer_name: str
    customer_phone: str
    items: List[InvoiceItem]
    subtotal: float
    discount: float
    discount_type: str
    vat_amount: float
    total: float
    payment_method: str
    notes: str
    qr_data: str
    created_at: str

class SettingsUpdate(BaseModel):
    company_name: Optional[str] = None
    company_vat_number: Optional[str] = None
    company_cr_number: Optional[str] = None  # Commercial Registration Number
    company_address: Optional[str] = None
    company_phone: Optional[str] = None
    company_logo: Optional[str] = None
    vat_enabled: Optional[bool] = None
    vat_rate: Optional[float] = None
    invoice_header: Optional[str] = None
    invoice_footer: Optional[str] = None
    invoice_notes: Optional[str] = None
    invoice_terms: Optional[str] = None  # Terms and conditions
    show_logo: Optional[bool] = None
    primary_color: Optional[str] = None

class SettingsResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "settings"
    company_name: str
    company_vat_number: str
    company_cr_number: str
    company_address: str
    company_phone: str
    company_logo: str
    vat_enabled: bool
    vat_rate: float
    invoice_header: str
    invoice_footer: str
    invoice_notes: str
    invoice_terms: str
    show_logo: bool
    primary_color: str

# ============ HELPERS ============

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def create_token(user_id: str, username: str) -> str:
    payload = {
        "user_id": user_id,
        "username": username,
        "exp": datetime.now(timezone.utc).timestamp() + 86400 * 7  # 7 days
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def verify_token(token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.InvalidTokenError:
        return None

async def get_current_user(authorization: str = None):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="غير مصرح")
    token = authorization.split(" ")[1]
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="رمز غير صالح")
    return payload

def generate_invoice_number() -> str:
    now = datetime.now(timezone.utc)
    # Short format: INV-YYMMDD-XXXX
    return f"INV-{now.strftime('%y%m%d')}-{str(uuid.uuid4())[:4].upper()}"

def generate_quote_number() -> str:
    now = datetime.now(timezone.utc)
    return f"QT-{now.strftime('%y%m%d')}-{str(uuid.uuid4())[:4].upper()}"

def generate_zatca_qr(seller_name: str, vat_number: str, timestamp: str, total: float, vat_amount: float) -> str:
    """Generate ZATCA compliant QR code data (TLV format encoded in Base64)"""
    def tlv_encode(tag: int, value: str) -> bytes:
        value_bytes = value.encode('utf-8')
        return bytes([tag, len(value_bytes)]) + value_bytes
    
    tlv_data = b''
    tlv_data += tlv_encode(1, seller_name)
    tlv_data += tlv_encode(2, vat_number)
    tlv_data += tlv_encode(3, timestamp)
    tlv_data += tlv_encode(4, f"{total:.2f}")
    tlv_data += tlv_encode(5, f"{vat_amount:.2f}")
    
    return base64.b64encode(tlv_data).decode('utf-8')

async def get_settings():
    settings = await db.settings.find_one({"id": "settings"}, {"_id": 0})
    if not settings:
        default_settings = {
            "id": "settings",
            "company_name": "شركتي",
            "company_vat_number": "",
            "company_cr_number": "",
            "company_address": "الرياض، المملكة العربية السعودية",
            "company_phone": "+966500000000",
            "company_logo": "",
            "vat_enabled": False,
            "vat_rate": 15.0,
            "invoice_header": "فاتورة",
            "invoice_footer": "شكراً لتعاملكم معنا",
            "invoice_notes": "",
            "invoice_terms": "",
            "show_logo": True,
            "primary_color": "#0F5132"
        }
        await db.settings.insert_one(default_settings)
        return default_settings
    # Ensure all fields exist for older settings
    defaults = {
        "company_logo": "",
        "company_cr_number": "",
        "invoice_header": "فاتورة",
        "invoice_footer": "شكراً لتعاملكم معنا",
        "invoice_notes": "",
        "invoice_terms": "",
        "show_logo": True,
        "primary_color": "#0F5132"
    }
    for key, value in defaults.items():
        if key not in settings:
            settings[key] = value
    return settings

# ============ AUTH ROUTES ============

@api_router.post("/auth/register", response_model=dict)
async def register(user: UserCreate):
    existing = await db.users.find_one({"username": user.username})
    if existing:
        raise HTTPException(status_code=400, detail="اسم المستخدم موجود مسبقاً")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "username": user.username,
        "password": hash_password(user.password),
        "name": user.name,
        "role": "admin",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id, user.username)
    return {"token": token, "user": {"id": user_id, "username": user.username, "name": user.name, "role": "admin"}}

@api_router.post("/auth/login", response_model=dict)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"username": credentials.username}, {"_id": 0})
    if not user or user["password"] != hash_password(credentials.password):
        raise HTTPException(status_code=401, detail="بيانات الدخول غير صحيحة")
    
    token = create_token(user["id"], user["username"])
    return {"token": token, "user": {"id": user["id"], "username": user["username"], "name": user["name"], "role": user["role"]}}

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(authorization: str = Header(None)):
    payload = await get_current_user(authorization)
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    return user

# ============ PRODUCTS ROUTES ============

@api_router.get("/products", response_model=List[ProductResponse])
async def get_products():
    products = await db.products.find({}, {"_id": 0}).to_list(1000)
    # Add default product_type for old products
    for product in products:
        if "product_type" not in product:
            product["product_type"] = "product"
    return products

# Generate SKU endpoint - must be before {product_id} route to avoid conflicts
@api_router.get("/products/generate-sku")
async def generate_sku():
    return {"sku": f"SKU-{str(uuid.uuid4())[:8].upper()}"}

@api_router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")
    if "product_type" not in product:
        product["product_type"] = "product"
    return product

@api_router.post("/products", response_model=ProductResponse)
async def create_product(product: ProductCreate):
    # Auto-generate SKU if not provided
    if not product.sku:
        product.sku = f"SKU-{str(uuid.uuid4())[:8].upper()}"
    else:
        existing = await db.products.find_one({"sku": product.sku})
        if existing:
            raise HTTPException(status_code=400, detail="رمز المنتج موجود مسبقاً")
    
    product_id = str(uuid.uuid4())
    product_doc = {
        "id": product_id,
        **product.model_dump(),
        "product_type": product.product_type or "product",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.products.insert_one(product_doc)
    del product_doc["_id"]
    return product_doc

@api_router.put("/products/{product_id}", response_model=ProductResponse)
async def update_product(product_id: str, product: ProductUpdate):
    existing = await db.products.find_one({"id": product_id})
    if not existing:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")
    
    update_data = {k: v for k, v in product.model_dump().items() if v is not None}
    if update_data:
        await db.products.update_one({"id": product_id}, {"$set": update_data})
    
    updated = await db.products.find_one({"id": product_id}, {"_id": 0})
    return updated

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str):
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")
    return {"message": "تم حذف المنتج بنجاح"}

# ============ CUSTOMERS ROUTES ============

@api_router.get("/customers", response_model=List[CustomerResponse])
async def get_customers():
    customers = await db.customers.find({}, {"_id": 0}).to_list(1000)
    return customers

# Search customers by phone - must be before {customer_id} route to avoid conflicts
@api_router.get("/customers/search")
async def search_customers(q: str = ""):
    if not q:
        return []
    # Search by name or phone
    customers = await db.customers.find({
        "$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}}
        ]
    }, {"_id": 0}).to_list(20)
    return customers

# Quick customer creation from invoice
class QuickCustomerCreate(BaseModel):
    name: str
    phone: str

@api_router.post("/customers/quick", response_model=CustomerResponse)
async def create_quick_customer(customer: QuickCustomerCreate):
    # Check if customer with same phone exists
    existing = await db.customers.find_one({"phone": customer.phone}, {"_id": 0})
    if existing:
        return existing
    
    customer_id = str(uuid.uuid4())
    customer_doc = {
        "id": customer_id,
        "name": customer.name,
        "phone": customer.phone,
        "email": "",
        "address": "",
        "vat_number": "",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.customers.insert_one(customer_doc)
    del customer_doc["_id"]
    return customer_doc

@api_router.get("/customers/{customer_id}", response_model=CustomerResponse)
async def get_customer(customer_id: str):
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="العميل غير موجود")
    return customer

@api_router.post("/customers", response_model=CustomerResponse)
async def create_customer(customer: CustomerCreate):
    customer_id = str(uuid.uuid4())
    customer_doc = {
        "id": customer_id,
        **customer.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.customers.insert_one(customer_doc)
    return {**customer_doc}

@api_router.put("/customers/{customer_id}", response_model=CustomerResponse)
async def update_customer(customer_id: str, customer: CustomerUpdate):
    existing = await db.customers.find_one({"id": customer_id})
    if not existing:
        raise HTTPException(status_code=404, detail="العميل غير موجود")
    
    update_data = {k: v for k, v in customer.model_dump().items() if v is not None}
    if update_data:
        await db.customers.update_one({"id": customer_id}, {"$set": update_data})
    
    updated = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    return updated

@api_router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str):
    result = await db.customers.delete_one({"id": customer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="العميل غير موجود")
    return {"message": "تم حذف العميل بنجاح"}

# ============ INVOICES ROUTES ============

@api_router.get("/invoices", response_model=List[InvoiceResponse])
async def get_invoices():
    invoices = await db.invoices.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    # Add default fields for old invoices
    for invoice in invoices:
        if "customer_phone" not in invoice:
            invoice["customer_phone"] = ""
        if "discount" not in invoice:
            invoice["discount"] = 0
        if "discount_type" not in invoice:
            invoice["discount_type"] = "amount"
    return invoices

@api_router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(invoice_id: str):
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="الفاتورة غير موجودة")
    if "customer_phone" not in invoice:
        invoice["customer_phone"] = ""
    if "discount" not in invoice:
        invoice["discount"] = 0
    if "discount_type" not in invoice:
        invoice["discount_type"] = "amount"
    return invoice

@api_router.post("/invoices", response_model=InvoiceResponse)
async def create_invoice(invoice: InvoiceCreate):
    settings = await get_settings()
    
    # Calculate totals
    subtotal = sum(item.total for item in invoice.items)
    
    # Calculate discount
    discount_amount = invoice.discount
    if invoice.discount_type == "percentage":
        discount_amount = subtotal * (invoice.discount / 100)
    
    # Calculate after discount
    subtotal_after_discount = subtotal - discount_amount
    vat_amount = subtotal_after_discount * (settings["vat_rate"] / 100) if settings["vat_enabled"] else 0
    total = subtotal_after_discount + vat_amount
    
    # Use custom date or current timestamp
    timestamp = invoice.invoice_date if invoice.invoice_date else datetime.now(timezone.utc).isoformat()
    
    # Generate invoice number and QR
    invoice_number = generate_invoice_number()
    qr_data = generate_zatca_qr(
        settings["company_name"],
        settings["company_vat_number"] if settings["vat_enabled"] else "",
        timestamp,
        total,
        vat_amount
    )
    
    invoice_id = str(uuid.uuid4())
    invoice_doc = {
        "id": invoice_id,
        "invoice_number": invoice_number,
        "customer_id": invoice.customer_id,
        "customer_name": invoice.customer_name,
        "customer_phone": invoice.customer_phone,
        "items": [item.model_dump() for item in invoice.items],
        "subtotal": subtotal,
        "discount": discount_amount,
        "discount_type": invoice.discount_type,
        "vat_amount": vat_amount,
        "total": total,
        "payment_method": invoice.payment_method,
        "notes": invoice.notes,
        "qr_data": qr_data,
        "created_at": timestamp
    }
    await db.invoices.insert_one(invoice_doc)
    
    # Update product stock (only for non-manual items that are products, not services)
    for item in invoice.items:
        if item.product_id and not item.is_manual:
            product = await db.products.find_one({"id": item.product_id})
            if product and product.get("product_type") != "service":
                await db.products.update_one(
                    {"id": item.product_id},
                    {"$inc": {"stock": -item.quantity}}
                )
    
    del invoice_doc["_id"]
    return invoice_doc

# Update invoice endpoint
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

# ============ QUOTATION MODELS ============

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

class QuotationResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    quote_number: str
    customer_id: Optional[str] = None
    customer_name: str
    customer_phone: str
    items: List[InvoiceItem]
    subtotal: float
    discount: float
    discount_type: str
    vat_amount: float
    total: float
    notes: str
    validity_days: int
    status: str
    valid_until: str
    created_at: str

@api_router.put("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(invoice_id: str, invoice_update: InvoiceUpdate):
    existing = await db.invoices.find_one({"id": invoice_id})
    if not existing:
        raise HTTPException(status_code=404, detail="الفاتورة غير موجودة")
    
    settings = await get_settings()
    
    # Build update data
    update_data = {}
    for key, value in invoice_update.model_dump().items():
        if value is not None:
            update_data[key] = value
    
    # If items are updated, recalculate totals
    if "items" in update_data:
        items = update_data["items"]
        subtotal = sum(item["total"] for item in items)
        
        discount = update_data.get("discount", existing.get("discount", 0))
        discount_type = update_data.get("discount_type", existing.get("discount_type", "amount"))
        
        discount_amount = discount
        if discount_type == "percentage":
            discount_amount = subtotal * (discount / 100)
        
        subtotal_after_discount = subtotal - discount_amount
        vat_amount = subtotal_after_discount * (settings["vat_rate"] / 100) if settings["vat_enabled"] else 0
        total = subtotal_after_discount + vat_amount
        
        update_data["subtotal"] = subtotal
        update_data["discount"] = discount_amount
        update_data["vat_amount"] = vat_amount
        update_data["total"] = total
        
        # Regenerate QR
        timestamp = update_data.get("invoice_date", existing.get("created_at"))
        update_data["qr_data"] = generate_zatca_qr(
            settings["company_name"],
            settings["company_vat_number"] if settings["vat_enabled"] else "",
            timestamp,
            total,
            vat_amount
        )
    
    if update_data:
        await db.invoices.update_one({"id": invoice_id}, {"$set": update_data})
    
    updated = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if "customer_phone" not in updated:
        updated["customer_phone"] = ""
    if "discount" not in updated:
        updated["discount"] = 0
    if "discount_type" not in updated:
        updated["discount_type"] = "amount"
    return updated

# ============ QUOTATIONS ROUTES ============

@api_router.get("/quotations", response_model=List[QuotationResponse])
async def get_quotations():
    quotations = await db.quotations.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return quotations

@api_router.get("/quotations/{quote_id}", response_model=QuotationResponse)
async def get_quotation(quote_id: str):
    quote = await db.quotations.find_one({"id": quote_id}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="عرض السعر غير موجود")
    return quote

@api_router.post("/quotations", response_model=QuotationResponse)
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
    valid_until = (now + timedelta(days=quotation.validity_days)).isoformat()
    
    quote_id = str(uuid.uuid4())
    quote_doc = {
        "id": quote_id,
        "quote_number": generate_quote_number(),
        "customer_id": quotation.customer_id,
        "customer_name": quotation.customer_name,
        "customer_phone": quotation.customer_phone,
        "items": [item.model_dump() for item in quotation.items],
        "subtotal": subtotal,
        "discount": discount_amount,
        "discount_type": quotation.discount_type,
        "vat_amount": vat_amount,
        "total": total,
        "notes": quotation.notes,
        "validity_days": quotation.validity_days,
        "status": "draft",
        "valid_until": valid_until,
        "created_at": now.isoformat()
    }
    await db.quotations.insert_one(quote_doc)
    return {k: v for k, v in quote_doc.items() if k != "_id"}

@api_router.put("/quotations/{quote_id}", response_model=QuotationResponse)
async def update_quotation(quote_id: str, quotation_update: QuotationUpdate):
    existing = await db.quotations.find_one({"id": quote_id})
    if not existing:
        raise HTTPException(status_code=404, detail="عرض السعر غير موجود")
    
    settings = await get_settings()
    update_data = {}
    for key, value in quotation_update.model_dump().items():
        if value is not None:
            update_data[key] = value
    
    if "items" in update_data:
        items = update_data["items"]
        subtotal = sum(item["total"] for item in items)
        
        discount = update_data.get("discount", existing.get("discount", 0))
        discount_type = update_data.get("discount_type", existing.get("discount_type", "amount"))
        
        discount_amount = discount
        if discount_type == "percentage":
            discount_amount = subtotal * (discount / 100)
        
        subtotal_after_discount = subtotal - discount_amount
        vat_amount = subtotal_after_discount * (settings["vat_rate"] / 100) if settings["vat_enabled"] else 0
        total = subtotal_after_discount + vat_amount
        
        update_data["subtotal"] = subtotal
        update_data["discount"] = discount_amount
        update_data["vat_amount"] = vat_amount
        update_data["total"] = total
    
    if "validity_days" in update_data:
        created = datetime.fromisoformat(existing["created_at"].replace("Z", "+00:00"))
        update_data["valid_until"] = (created + timedelta(days=update_data["validity_days"])).isoformat()
    
    if update_data:
        await db.quotations.update_one({"id": quote_id}, {"$set": update_data})
    
    updated = await db.quotations.find_one({"id": quote_id}, {"_id": 0})
    return updated

@api_router.delete("/quotations/{quote_id}")
async def delete_quotation(quote_id: str):
    result = await db.quotations.delete_one({"id": quote_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="عرض السعر غير موجود")
    return {"message": "تم حذف عرض السعر بنجاح"}

@api_router.post("/quotations/{quote_id}/convert", response_model=InvoiceResponse)
async def convert_quotation_to_invoice(quote_id: str):
    quote = await db.quotations.find_one({"id": quote_id}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="عرض السعر غير موجود")
    
    settings = await get_settings()
    
    subtotal = quote["subtotal"]
    discount_amount = quote["discount"]
    subtotal_after_discount = subtotal - discount_amount
    vat_amount = subtotal_after_discount * (settings["vat_rate"] / 100) if settings["vat_enabled"] else 0
    total = subtotal_after_discount + vat_amount
    
    timestamp = datetime.now(timezone.utc).isoformat()
    invoice_number = generate_invoice_number()
    qr_data = generate_zatca_qr(
        settings["company_name"],
        settings["company_vat_number"] if settings["vat_enabled"] else "",
        timestamp,
        total,
        vat_amount
    )
    
    invoice_id = str(uuid.uuid4())
    invoice_doc = {
        "id": invoice_id,
        "invoice_number": invoice_number,
        "customer_id": quote.get("customer_id"),
        "customer_name": quote["customer_name"],
        "customer_phone": quote.get("customer_phone", ""),
        "items": quote["items"],
        "subtotal": subtotal,
        "discount": discount_amount,
        "discount_type": quote.get("discount_type", "amount"),
        "vat_amount": vat_amount,
        "total": total,
        "payment_method": "cash",
        "notes": quote.get("notes", ""),
        "qr_data": qr_data,
        "created_at": timestamp
    }
    await db.invoices.insert_one(invoice_doc)
    
    # Update quotation status
    await db.quotations.update_one({"id": quote_id}, {"$set": {"status": "converted"}})
    
    # Update stock for product items
    for item in quote["items"]:
        if item.get("product_id") and not item.get("is_manual"):
            product = await db.products.find_one({"id": item["product_id"]})
            if product and product.get("product_type") != "service":
                await db.products.update_one(
                    {"id": item["product_id"]},
                    {"$inc": {"stock": -item["quantity"]}}
                )
    
    return {k: v for k, v in invoice_doc.items() if k != "_id"}

# ============ SETTINGS ROUTES ============

@api_router.get("/settings", response_model=SettingsResponse)
async def get_settings_route():
    return await get_settings()

@api_router.put("/settings", response_model=SettingsResponse)
async def update_settings(settings: SettingsUpdate):
    update_data = {k: v for k, v in settings.model_dump().items() if v is not None}
    if update_data:
        await db.settings.update_one({"id": "settings"}, {"$set": update_data}, upsert=True)
    return await get_settings()

# ============ DASHBOARD ROUTES ============

@api_router.get("/dashboard/stats")
async def get_dashboard_stats():
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Total products
    total_products = await db.products.count_documents({})
    
    # Total customers
    total_customers = await db.customers.count_documents({})
    
    # Today's sales
    today_invoices = await db.invoices.find({
        "created_at": {"$gte": today.isoformat()}
    }, {"_id": 0}).to_list(1000)
    
    today_sales = sum(inv.get("total", 0) for inv in today_invoices)
    today_invoices_count = len(today_invoices)
    
    # Total sales
    all_invoices = await db.invoices.find({}, {"_id": 0, "total": 1}).to_list(10000)
    total_sales = sum(inv.get("total", 0) for inv in all_invoices)
    total_invoices = len(all_invoices)
    
    # Low stock products
    low_stock = await db.products.count_documents({"stock": {"$lt": 10}})
    
    # Recent invoices
    recent_invoices = await db.invoices.find({}, {"_id": 0}).sort("created_at", -1).to_list(5)
    
    return {
        "total_products": total_products,
        "total_customers": total_customers,
        "today_sales": today_sales,
        "today_invoices_count": today_invoices_count,
        "total_sales": total_sales,
        "total_invoices": total_invoices,
        "low_stock_products": low_stock,
        "recent_invoices": recent_invoices
    }

@api_router.get("/reports/sales")
async def get_sales_report(start_date: str = None, end_date: str = None):
    query = {}
    if start_date:
        query["created_at"] = {"$gte": start_date}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = end_date
        else:
            query["created_at"] = {"$lte": end_date}
    
    invoices = await db.invoices.find(query, {"_id": 0}).sort("created_at", -1).to_list(10000)
    
    total_sales = sum(inv.get("total", 0) for inv in invoices)
    total_vat = sum(inv.get("vat_amount", 0) for inv in invoices)
    
    # Group by date
    daily_sales = {}
    for inv in invoices:
        date = inv["created_at"][:10]
        if date not in daily_sales:
            daily_sales[date] = {"date": date, "total": 0, "count": 0}
        daily_sales[date]["total"] += inv.get("total", 0)
        daily_sales[date]["count"] += 1
    
    # Payment method breakdown
    payment_breakdown = {"cash": 0, "card": 0}
    for inv in invoices:
        method = inv.get("payment_method", "cash")
        payment_breakdown[method] = payment_breakdown.get(method, 0) + inv.get("total", 0)
    
    return {
        "total_sales": total_sales,
        "total_vat": total_vat,
        "invoice_count": len(invoices),
        "daily_sales": list(daily_sales.values()),
        "payment_breakdown": payment_breakdown,
        "invoices": invoices
    }

# ============ ROOT ============

@api_router.get("/")
async def root():
    return {"message": "نظام المبيعات ZATCA - مرحباً"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
