<script setup lang="ts">
const beforeLoad = () => {
  console.log("beforeLoad");
};
const beforeMount = () => {
  console.log("beforeMount");
};
const afterMount = () => {
  console.log("afterMount");
};
const beforeUnmount = () => {
  console.log("beforeUnmount");
};
const afterUnmount = () => {
  console.log("afterUnmount");
};
const activated = () => {
  console.log("activated");
};
const deactivated = () => {
  console.log("deactivated");
};
</script>

<template>
  <WujieVue
    :beforeLoad="beforeLoad"
    :beforeMount="beforeMount"
    :afterMount="afterMount"
    :beforeUnmount="beforeUnmount"
    :afterUnmount="afterUnmount"
    :activated="activated"
    :deactivated="deactivated"
    :props="{ name: '测试', description: '测试描述'}"
    url="http://127.0.0.1:5175/"
    name="vue3"
  ></WujieVue>
  <!--子应用vue3-->
</template>

<style scoped></style>
