<template>
  <div class="product-card">
    <img :src="image" :alt="title" class="product-image" />
    <h3 class="product-title">{{ title }}</h3>
    <p class="product-price">{{ formattedPrice }}</p>
    <button class="add-to-cart" @click="addToCart">
      加入购物车
    </button>
  </div>
</template>

<script>
export default {
  name: 'ProductCard',
  props: {
    title: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    image: {
      type: String,
      default: '/placeholder.png',
    },
  },
  computed: {
    formattedPrice() {
      return `¥${this.price.toFixed(2)}`;
    },
  },
  methods: {
    addToCart() {
      this.$emit('add-to-cart', {
        title: this.title,
        price: this.price,
      });
    },
  },
};
</script>

<style scoped>
.product-card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  max-width: 280px;
}

.product-image {
  width: 100%;
  height: 200px;
  object-fit: cover;
  border-radius: 4px;
}

.product-title {
  font-size: 16px;
  margin: 12px 0 8px;
}

.product-price {
  color: #f56c6c;
  font-weight: bold;
  font-size: 18px;
  margin-bottom: 12px;
}

.add-to-cart {
  width: 100%;
  padding: 10px;
  background: #409eff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.add-to-cart:hover {
  background: #66b1ff;
}
</style>
