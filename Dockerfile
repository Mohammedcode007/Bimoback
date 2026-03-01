# صورة خفيفة لبيئة Node
FROM node:20-alpine

WORKDIR /app

# نسخ ملفات الحزم أولاً لتسريع البناء
COPY package*.json ./

# تثبيت الاعتمادات (أفضل للإنتاج)
RUN npm ci

# نسخ باقي المشروع
COPY . .

# بناء TypeScript (يُفترض وجود script اسمه build)
RUN npm run build

# (اختياري) توثيق المنفذ - التطبيق يجب أن يقرأ PORT من env
EXPOSE 5000

# تشغيل السيرفر بعد البناء
CMD ["node", "dist/server.js"]