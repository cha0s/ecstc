(module

  (memory $data (import "F" "data") 0)
  (memory $dirty (import "F" "dirty") 0)
  (import "F" "callback" (func $callback (param i32) (param i32)))
  (global $length (import "F" "length") (mut i32))

  (func (export "tick") (param $delta f32) (param $total f32)
    ;;
    (local $i i32)
    (local $instance externref)
    ;;
    (local.set $i (i32.const 0))
    ;; while (i < length)
    (loop
      (br_if 1 (i32.ge_u (local.get $i) (global.get $length)))
      ;;   data[i] += (total + i)
      (f32.store
        $data
        (i32.mul (local.get $i) (i32.const 4))
        (f32.add
          (f32.add (f32.load $data (i32.mul (local.get $i) (i32.const 4))) (local.get $delta))
          (f32.convert_i32_u (local.get $i))
        )
      )
      ;;   if (0 === (i & 1))
      (if
        (i32.eqz (i32.and (local.get $i) (i32.const 1)))
        (then
          ;; callback(0, i)
          (call $callback (i32.const 0) (local.get $i))
        )
      )
      ;;   i += 1;
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      ;;
      (br 0)
    )
  )
)